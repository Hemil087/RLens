import asyncio
from typing import Callable, Awaitable
from algorithms.base import BaseAgent
from algorithms.q_learning import QLearningAgent
from algorithms.sarsa import SARSAAgent
from algorithms.reinforce import REINFORCEAgent
from algorithms.actor_critic import ActorCriticAgent
from core.env_wrapper import make_env
from utils.stats import RollingAverage


# Episodes buffered before flushing a single `episode_batch` WS message.
# Set high enough that per-episode overhead is negligible; low enough that the
# live chart still feels live (25 eps × ~50 eps/sec on tabular ≈ 2 flushes/sec).
# Do not silently regress this to 1 — it will restore the pre-P1 send bottleneck.
BATCH_SIZE = 25


ALGORITHM_REGISTRY: dict[str, type[BaseAgent]] = {
    "q_learning": QLearningAgent,
    "sarsa": SARSAAgent,
    "reinforce": REINFORCEAgent,
    "actor_critic": ActorCriticAgent,
}


def build_agent(algorithm: str, params: dict) -> BaseAgent:
    cls = ALGORITHM_REGISTRY.get(algorithm)
    if cls is None:
        raise ValueError(f"Unknown algorithm: {algorithm}")
    filtered = {k: v for k, v in params.items() if k != "checkpoint_every"}
    # actor_critic uses alpha_v (critic LR); guard against old alpha_w param names
    if algorithm == "actor_critic" and "alpha_w" in filtered:
        filtered["alpha_v"] = filtered.pop("alpha_w")
    return cls(**filtered)


async def run_training(
    algorithm: str,
    params: dict,
    send: Callable[[dict], Awaitable[None]],
    cancelled_flag: list[bool],
):
    checkpoint_every = int(params.get("checkpoint_every", 100))
    n_episodes = int(params.get("n_episodes", 3000))

    agent = build_agent(algorithm, params)
    env = make_env()
    rolling_avg = RollingAverage(window=100)

    rewards_history: list[float] = []
    convergence_episode: int | None = None
    convergence_threshold = 7.0
    loop = asyncio.get_event_loop()

    def training_loop():
        nonlocal convergence_episode

        # Episode messages are buffered and flushed as `episode_batch` messages.
        # This collapses ~n_episodes per-episode sends into ~n_episodes/BATCH_SIZE
        # batch sends and — more importantly — removes the per-episode
        # `.result()` round-trip that used to gate training throughput.
        episode_batch: list[dict] = []

        def flush_episode_batch():
            if not episode_batch:
                return
            msg = {"type": "episode_batch", "episodes": episode_batch.copy()}
            episode_batch.clear()
            # Fire-and-forget. `run_coroutine_threadsafe` schedules onto the
            # event loop in call order, and Starlette's WebSocket serializes
            # sends internally, so message order is preserved.
            asyncio.run_coroutine_threadsafe(send(msg), loop)

        for episode in range(n_episodes):
            if cancelled_flag[0]:
                break

            state, _ = env.reset()
            total_reward = 0.0
            steps = 0
            done = False
            episode_td_errors: list[float] = []

            while not done:
                if cancelled_flag[0]:
                    break
                action = agent.select_action(state)
                next_state, reward, terminated, truncated, _ = env.step(action)
                done = terminated or truncated
                metrics = agent.update(state, action, float(reward), next_state, done)
                state = next_state
                total_reward += float(reward)
                steps += 1
                if "td_error" in metrics:
                    episode_td_errors.append(metrics["td_error"])

            episode_extra: dict = {}
            if hasattr(agent, "end_episode"):
                result = agent.end_episode()
                if isinstance(result, dict):
                    episode_extra.update(result)

            avg_reward = rolling_avg.update(total_reward)
            rewards_history.append(total_reward)
            epsilon = getattr(agent, "epsilon", None)

            extra_metrics: dict = {}
            if episode_td_errors:
                extra_metrics["td_error"] = float(sum(episode_td_errors) / len(episode_td_errors))
            extra_metrics.update({k: v for k, v in episode_extra.items() if k not in extra_metrics})

            # Per-episode entry — note: NO "type" field. The batch wrapper carries it.
            entry = {
                "episode": episode + 1,
                "reward": total_reward,
                "steps": steps,
                "rolling_avg_reward": round(avg_reward, 4),
                "extra_metrics": extra_metrics,
            }
            if epsilon is not None:
                entry["epsilon"] = round(epsilon, 4)

            episode_batch.append(entry)

            if convergence_episode is None and avg_reward >= convergence_threshold and episode >= 99:
                convergence_episode = episode + 1

            if len(episode_batch) >= BATCH_SIZE:
                flush_episode_batch()

            if (episode + 1) % checkpoint_every == 0:
                # Force-flush pending episodes so a checkpoint tick never
                # arrives on the frontend ahead of the episode it belongs to.
                flush_episode_batch()
                snapshot = agent.get_policy_snapshot()
                checkpoint_msg = {
                    "type": "checkpoint",
                    "episode": episode + 1,
                    "policy_snapshot": snapshot,
                }
                asyncio.run_coroutine_threadsafe(send(checkpoint_msg), loop)

        # Flush any remaining episodes before the completion message.
        flush_episode_batch()

        final_avg = (
            sum(rewards_history[-100:]) / min(len(rewards_history), 100)
            if rewards_history else 0.0
        )
        all_checkpoints = list(range(checkpoint_every, n_episodes + 1, checkpoint_every))
        complete_msg = {
            "type": "training_complete",
            "total_episodes": len(rewards_history),
            "final_avg_reward": round(final_avg, 4),
            "convergence_episode": convergence_episode,
            "all_checkpoints": all_checkpoints,
        }
        # Block on the final message: the training thread must not exit until
        # all queued sends (batches, checkpoints, complete) have actually been
        # written to the websocket. Since sends are FIFO-ordered on the loop
        # and Starlette serializes them, awaiting the last one implies all
        # earlier ones have flushed.
        asyncio.run_coroutine_threadsafe(send(complete_msg), loop).result()
        env.close()

    await loop.run_in_executor(None, training_loop)