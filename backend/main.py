import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState
from models.schemas import ReplayGifRequest, PolicyAnalyzeRequest
from core.env_wrapper import make_env, decode_state, ACTION_NAMES, N_STATES, N_ACTIONS
from core.trainer import run_training

app = FastAPI(title="RLens Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/env/info")
async def env_info():
    return {
        "n_states": N_STATES,
        "n_actions": N_ACTIONS,
        "action_names": ACTION_NAMES,
        "locations": {"R": [0, 0], "G": [0, 4], "Y": [4, 0], "B": [4, 3]},
    }


@app.get("/algorithms")
async def algorithms():
    return [
        {
            "id": "q_learning",
            "name": "Q-Learning",
            "description": "Off-policy tabular TD control (Sutton & Barto Ch.6.5). Learns the optimal Q-function directly by always bootstrapping from the greedy action. Converges fast on Taxi-v3 (~800–1200 episodes) but overestimates values early due to the max operator.",
            "params": [
                {"name": "alpha", "label": "Learning Rate", "min": 0.001, "max": 1.0, "default": 0.1, "step": 0.001},
                {"name": "gamma", "label": "Discount Factor", "min": 0.8, "max": 1.0, "default": 0.99, "step": 0.01},
                {"name": "epsilon_end", "label": "Epsilon End", "min": 0.001, "max": 0.1, "default": 0.01, "step": 0.001},
                {"name": "n_episodes", "label": "Episodes", "min": 500, "max": 10000, "default": 3000, "step": 100},
                {"name": "checkpoint_every", "label": "Checkpoint Every", "min": 50, "max": 500, "default": 100, "step": 50},
            ],
        },
        {
            "id": "sarsa",
            "name": "SARSA",
            "description": "On-policy tabular TD control (Sutton & Barto Ch.6.4). Updates using the action actually taken next, not the greedy one. More conservative than Q-learning — develops a safer policy near penalty states. Converges in ~1200–1800 episodes.",
            "params": [
                {"name": "alpha", "label": "Learning Rate", "min": 0.001, "max": 1.0, "default": 0.1, "step": 0.001},
                {"name": "gamma", "label": "Discount Factor", "min": 0.8, "max": 1.0, "default": 0.99, "step": 0.01},
                {"name": "epsilon_end", "label": "Epsilon End", "min": 0.001, "max": 0.1, "default": 0.01, "step": 0.001},
                {"name": "n_episodes", "label": "Episodes", "min": 500, "max": 10000, "default": 3000, "step": 100},
                {"name": "checkpoint_every", "label": "Checkpoint Every", "min": 50, "max": 500, "default": 100, "step": 50},
            ],
        },
        {
            "id": "reinforce",
            "name": "REINFORCE",
            "description": "Monte Carlo policy gradient with baseline (Sutton & Barto Ch.13.4). Collects full episode trajectories before updating. High variance — the reward curve will look noisy. The value network baseline helps significantly. Converges in ~2000–4000 episodes.",
            "params": [
                {"name": "alpha_theta", "label": "Policy LR", "min": 1e-5, "max": 0.1, "default": 1e-3, "step": 1e-5},
                {"name": "alpha_w", "label": "Baseline LR", "min": 1e-5, "max": 0.1, "default": 1e-3, "step": 1e-5},
                {"name": "gamma", "label": "Discount Factor", "min": 0.8, "max": 1.0, "default": 0.99, "step": 0.01},
                {"name": "n_episodes", "label": "Episodes", "min": 500, "max": 10000, "default": 3000, "step": 100},
                {"name": "checkpoint_every", "label": "Checkpoint Every", "min": 50, "max": 500, "default": 100, "step": 50},
            ],
        },
        {
            "id": "actor_critic",
            "name": "Actor-Critic",
            "description": "One-step online Actor-Critic (Sutton & Barto Ch.13.5). Updates every step using TD error — lower variance than REINFORCE. The reward curve rises more steadily. Uses the same policy/value networks as REINFORCE. Converges in ~1500–2500 episodes.",
            "params": [
                {"name": "alpha_theta", "label": "Policy LR", "min": 1e-5, "max": 0.1, "default": 1e-3, "step": 1e-5},
                {"name": "alpha_v", "label": "Critic LR", "min": 1e-5, "max": 0.1, "default": 1e-2, "step": 1e-5},
                {"name": "gamma", "label": "Discount Factor", "min": 0.8, "max": 1.0, "default": 0.99, "step": 0.01},
                {"name": "n_episodes", "label": "Episodes", "min": 500, "max": 10000, "default": 3000, "step": 100},
                {"name": "checkpoint_every", "label": "Checkpoint Every", "min": 50, "max": 500, "default": 100, "step": 50},
            ],
        },
    ]


@app.websocket("/ws/train")
async def ws_train(websocket: WebSocket):
    await websocket.accept()
    cancelled_flag = [False]

    async def send(msg: dict):
        try:
            await websocket.send_json(msg)
        except Exception:
            cancelled_flag[0] = True

    try:
        # Guard: only attempt to receive while the client is still connected.
        # After a training run finishes, `bench.py` (and normal clients that
        # close after `training_complete`) will already have disconnected by
        # the time we loop back here. Without this check, starlette raises
        # a RuntimeError from receive_json() with the message
        # "Cannot call 'receive' once a disconnect message has been received"
        # every time a benchmark or real client hangs up cleanly.
        while websocket.client_state == WebSocketState.CONNECTED:
            data = await websocket.receive_json()
            if data.get("type") != "start_training":
                continue

            algorithm = data.get("algorithm", "q_learning")
            params = data.get("params", {})
            cancelled_flag[0] = False

            async def listen_for_cancel():
                while not cancelled_flag[0]:
                    try:
                        msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.2)
                        if msg.get("type") == "cancel":
                            cancelled_flag[0] = True
                            return
                    except asyncio.TimeoutError:
                        continue
                    except Exception:
                        return

            async def training_with_cleanup():
                try:
                    await run_training(algorithm, params, send, cancelled_flag)
                finally:
                    cancelled_flag[0] = True  # stop the cancel listener

            await asyncio.gather(
                training_with_cleanup(),
                listen_for_cancel(),
                return_exceptions=True,
            )

    except WebSocketDisconnect:
        cancelled_flag[0] = True


@app.post("/replay/gif")
async def replay_gif(request: ReplayGifRequest):
    from core.gif_generator import generate_episode_gif

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, generate_episode_gif, request.policy_snapshot, request.fps
    )
    return result


@app.post("/policy/analyze")
async def policy_analyze(request: PolicyAnalyzeRequest):
    import numpy as np

    snapshot = request.policy_snapshot
    results = {}

    if snapshot.get("type") == "q_table":
        q = np.array(snapshot["q_table"])
        greedy = np.argmax(q, axis=1)

        q_max = q.max(axis=1, keepdims=True)
        q_min = q.min(axis=1, keepdims=True)
        spread = (q_max - q_min).flatten()
        results["q_value_spread_mean"] = float(spread.mean())

        q_shifted = q - q.min(axis=1, keepdims=True)
        row_sum = q_shifted.sum(axis=1, keepdims=True) + 1e-8
        probs = q_shifted / row_sum
    else:
        probs = np.array(snapshot["action_probs"])
        greedy = np.array(snapshot["greedy_policy"])
        results["q_value_spread_mean"] = None

    probs = np.clip(probs, 1e-10, 1.0)
    entropy_per_state = -np.sum(probs * np.log(probs), axis=1)
    results["policy_entropy_mean"] = float(entropy_per_state.mean())
    results["policy_entropy_per_state"] = entropy_per_state.tolist()

    greedy_arr = np.array(greedy)
    unique, counts = np.unique(greedy_arr, return_counts=True)
    most_common_action = unique[counts.argmax()]
    suboptimal = float((greedy_arr != most_common_action).mean() * 100)
    results["suboptimal_action_pct"] = suboptimal

    return results