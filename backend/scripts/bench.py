"""
RLens performance benchmark.

Measures training throughput in three modes to isolate where time is spent:

  pure         Direct agent + env loop (no trainer, no WS). Establishes the
               ceiling — how fast can the RL code alone run.

  trainer-noop Runs the real trainer but hands it an async no-op `send`
               callback. Isolates trainer overhead (batching, threadsafe
               scheduling) from the WS/network path.

  ws           Full stack: uvicorn server in-process + a websockets client.
               End-to-end throughput as observed by the client. This is what
               regressions in send-path work would show up in.

Usage:
    python scripts/bench.py                        # 3000 eps, q_learning, all modes
    python scripts/bench.py --algorithm sarsa
    python scripts/bench.py --episodes 1000 --modes pure trainer-noop
    python scripts/bench.py --algorithms all       # sweep all 4

Run from `backend/` directory.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import threading
import time
from pathlib import Path

# Make backend/ importable when running from either backend/ or repo root
BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from core.env_wrapper import make_env  # noqa: E402
from core.trainer import build_agent, run_training  # noqa: E402


DEFAULT_PARAMS: dict[str, dict[str, float | int]] = {
    "q_learning":   {"alpha": 0.1, "gamma": 0.99, "epsilon_end": 0.01, "n_episodes": 3000, "checkpoint_every": 100},
    "sarsa":        {"alpha": 0.1, "gamma": 0.99, "epsilon_end": 0.01, "n_episodes": 3000, "checkpoint_every": 100},
    "reinforce":    {"alpha_theta": 1e-4, "alpha_w": 0.1, "gamma": 0.99, "n_episodes": 3000, "checkpoint_every": 100},
    "actor_critic": {"alpha_theta": 1e-4, "alpha_v": 0.01, "gamma": 0.99, "n_episodes": 3000, "checkpoint_every": 100},
}


def _params(algorithm: str, episodes: int) -> dict:
    p = dict(DEFAULT_PARAMS[algorithm])
    p["n_episodes"] = episodes
    return p


# ---------------------------------------------------------------------------
# Mode 1: pure agent+env — no trainer, no WS
# ---------------------------------------------------------------------------

def bench_pure(algorithm: str, episodes: int) -> float:
    agent = build_agent(algorithm, _params(algorithm, episodes))
    env = make_env()
    t0 = time.perf_counter()
    for _ep in range(episodes):
        state, _ = env.reset()
        done = False
        while not done:
            action = agent.select_action(state)
            ns, r, term, trunc, _ = env.step(action)
            done = term or trunc
            agent.update(state, action, float(r), ns, done)
            state = ns
        if hasattr(agent, "end_episode"):
            agent.end_episode()
    return time.perf_counter() - t0


# ---------------------------------------------------------------------------
# Mode 2: real trainer + no-op send. Times the trainer's overhead in isolation.
# ---------------------------------------------------------------------------

async def bench_trainer_noop(algorithm: str, episodes: int) -> float:
    messages: list[dict] = []

    async def noop_send(msg: dict) -> None:
        # Collect for message-count reporting but don't do any real I/O.
        messages.append(msg)

    cancelled = [False]
    t0 = time.perf_counter()
    await run_training(algorithm, _params(algorithm, episodes), noop_send, cancelled)
    elapsed = time.perf_counter() - t0
    # Stash the message count on the coroutine's return so the caller can report
    bench_trainer_noop.last_message_count = len(messages)  # type: ignore[attr-defined]
    return elapsed


# ---------------------------------------------------------------------------
# Mode 3: full stack — real uvicorn server + real websocket client.
# ---------------------------------------------------------------------------

async def _ws_client_run(port: int, algorithm: str, episodes: int) -> tuple[float, int]:
    import websockets

    # Retry connect for a moment while uvicorn is coming up.
    for attempt in range(30):
        try:
            ws = await websockets.connect(f"ws://127.0.0.1:{port}/ws/train")
            break
        except (ConnectionRefusedError, OSError):
            await asyncio.sleep(0.1)
    else:
        raise RuntimeError("uvicorn never came up")

    async with ws:
        await ws.send(json.dumps({
            "type": "start_training",
            "algorithm": algorithm,
            "params": _params(algorithm, episodes),
        }))

        message_count = 0
        t0 = time.perf_counter()
        while True:
            raw = await ws.recv()
            msg = json.loads(raw)
            message_count += 1
            if msg.get("type") == "training_complete":
                elapsed = time.perf_counter() - t0
                return elapsed, message_count


def bench_ws(algorithm: str, episodes: int, port: int = 8767) -> tuple[float, int]:
    import uvicorn
    from main import app

    server_thread = threading.Thread(
        target=lambda: uvicorn.run(app, host="127.0.0.1", port=port, log_level="error"),
        daemon=True,
    )
    server_thread.start()
    # Give uvicorn a bit of headroom before the client tries to connect.
    time.sleep(1.5)
    return asyncio.run(_ws_client_run(port, algorithm, episodes))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _fmt_row(mode: str, algo: str, episodes: int, elapsed: float, extra: str = "") -> str:
    eps_per_sec = episodes / elapsed if elapsed > 0 else 0
    return f"  {mode:14s}  {algo:14s}  {episodes:>5d} eps  {elapsed:6.2f} s  {eps_per_sec:8.1f} eps/s  {extra}"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--algorithm", default="q_learning",
                        choices=["q_learning", "sarsa", "reinforce", "actor_critic"])
    parser.add_argument("--algorithms", default=None,
                        help="Comma-separated algorithms, or 'all'. Overrides --algorithm.")
    parser.add_argument("--episodes", type=int, default=3000)
    parser.add_argument("--modes", nargs="+", default=["pure", "trainer-noop", "ws"],
                        choices=["pure", "trainer-noop", "ws"])
    parser.add_argument("--ws-port", type=int, default=8767)
    args = parser.parse_args()

    if args.algorithms == "all":
        algorithms = ["q_learning", "sarsa", "reinforce", "actor_critic"]
    elif args.algorithms:
        algorithms = [a.strip() for a in args.algorithms.split(",")]
    else:
        algorithms = [args.algorithm]

    print(f"RLens benchmark — {args.episodes} episodes per run")
    print(f"  algorithms: {', '.join(algorithms)}")
    print(f"  modes:      {', '.join(args.modes)}")
    print()
    print(f"  {'mode':14s}  {'algorithm':14s}  {'run':>5s}       {'elapsed':>6s}   {'throughput':>10s}   info")

    for algo in algorithms:
        if "pure" in args.modes:
            elapsed = bench_pure(algo, args.episodes)
            print(_fmt_row("pure", algo, args.episodes, elapsed))
        if "trainer-noop" in args.modes:
            elapsed = asyncio.run(bench_trainer_noop(algo, args.episodes))
            nmsg = getattr(bench_trainer_noop, "last_message_count", 0)
            print(_fmt_row("trainer-noop", algo, args.episodes, elapsed, f"{nmsg} WS msgs"))
        if "ws" in args.modes:
            # Bump the port for each algo run so we don't collide with a still-shutting-down server.
            args.ws_port += 1
            elapsed, nmsg = bench_ws(algo, args.episodes, port=args.ws_port)
            print(_fmt_row("ws", algo, args.episodes, elapsed, f"{nmsg} WS msgs"))


if __name__ == "__main__":
    main()