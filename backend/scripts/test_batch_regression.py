"""
Regression guard for the P1 batching invariant.

Fails loudly if the trainer ever regresses to one WS message per episode.
Run:

    cd backend && python3 scripts/test_batch_regression.py

Exits 0 on pass, 1 on failure. Suitable for a CI hook or pre-commit check
if the project later adopts one.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from core.trainer import BATCH_SIZE, run_training  # noqa: E402


N_EPISODES = 200
CHECKPOINT_EVERY = 100
# Expected message shape post-P1:
#   ceil(N_EPISODES / BATCH_SIZE) episode_batch messages
# + N_EPISODES / CHECKPOINT_EVERY checkpoint messages
# + 1 training_complete
# For 200 eps / BATCH_SIZE=25 / checkpoint_every=100:
#   8 batches + 2 checkpoints + 1 complete = 11
# We allow a small ceiling for safety (batch flushes before checkpoints etc.)
EXPECTED_MAX_MESSAGES = 20


def main() -> int:
    print(f"Batching regression check")
    print(f"  BATCH_SIZE (from trainer.py):       {BATCH_SIZE}")
    print(f"  simulated episodes:                 {N_EPISODES}")
    print(f"  checkpoint_every:                   {CHECKPOINT_EVERY}")
    print(f"  ceiling on total WS messages:       {EXPECTED_MAX_MESSAGES}")
    print()

    # Sanity 1: constant hasn't been reduced to something meaningless.
    assert BATCH_SIZE >= 5, (
        f"BATCH_SIZE regressed to {BATCH_SIZE}. This defeats the P1 send-batching "
        f"win. See backend/core/trainer.py — the constant should stay >= 5."
    )

    # Sanity 2: run the real trainer and count messages.
    messages: list[dict] = []

    async def collect(msg: dict) -> None:
        messages.append(msg)

    cancelled = [False]
    asyncio.run(run_training(
        "q_learning",
        {
            "alpha": 0.1,
            "gamma": 0.99,
            "epsilon_end": 0.01,
            "n_episodes": N_EPISODES,
            "checkpoint_every": CHECKPOINT_EVERY,
        },
        collect,
        cancelled,
    ))

    by_type: dict[str, int] = {}
    total_episodes_in_batches = 0
    for m in messages:
        by_type[m["type"]] = by_type.get(m["type"], 0) + 1
        if m["type"] == "episode_batch":
            total_episodes_in_batches += len(m["episodes"])

    print(f"  actual total messages:              {len(messages)}")
    for k, v in sorted(by_type.items()):
        print(f"    - {k:22s}          {v}")
    print(f"  episodes accounted for in batches:  {total_episodes_in_batches}")
    print()

    # Sanity 3: total message count under the ceiling.
    assert len(messages) <= EXPECTED_MAX_MESSAGES, (
        f"WS message count regressed: got {len(messages)}, expected <= "
        f"{EXPECTED_MAX_MESSAGES}. Likely someone reintroduced per-episode "
        f"sends in trainer.py."
    )

    # Sanity 4: no episodes went missing.
    assert total_episodes_in_batches == N_EPISODES, (
        f"Episode count mismatch: batches contained {total_episodes_in_batches}, "
        f"expected {N_EPISODES}. The batch flush logic near checkpoints or "
        f"training_complete may be broken."
    )

    # Sanity 5: batch messages exist at all.
    assert by_type.get("episode_batch", 0) > 0, (
        "No `episode_batch` messages emitted. Trainer is likely emitting the "
        "legacy `episode_update` type again."
    )

    # Sanity 6: no legacy `episode_update` messages.
    assert by_type.get("episode_update", 0) == 0, (
        f"Legacy `episode_update` messages emitted ({by_type['episode_update']}). "
        f"P1 protocol replaces these with `episode_batch`."
    )

    print("PASS — batching invariant holds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())