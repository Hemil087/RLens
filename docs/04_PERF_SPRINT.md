# RLens — Performance Sprint Plan

## Audit Summary (measured against actual repo code, commit `4014b4c`)

| # | Problem | Location | Cost | Severity |
|---|---|---|---|---|
| 1 | Training thread blocks on `.result()` per episode | `backend/core/trainer.py:101` | 3000 synchronous event-loop round-trips; caps training throughput | 🔴 Critical |
| 2 | O(n²×100) rolling-average recompute; backend already sends it | `frontend/lib/smoothing.ts` + `RewardCurve.tsx`, `CompareChart.tsx`, `MetricsChart.tsx` | ~900M ops by ep 3000; ×2 on compare page | 🔴 Critical |
| 3 | Whole-store Zustand subscriptions | `RewardCurve`, `QTableHeatmap`, `MetricsChart`, `useTrainingSocket` | Every component (incl. 3000-rect heatmap) re-renders per episode message | 🔴 Critical |
| 4 | 1 WS msg + 1 store update + full chart re-diff per episode; `[...arr, x]` appends | `trainer.py`, `trainingStore.ts`, chart data `useMemo`s | ~3000 renders/run; O(n²) allocations | 🟠 High |
| 5 | Checkpoint payloads: 60KB (Q), 128KB (PG — sends `theta` **and** `action_probs`, duplicated), full float64 precision | `q_learning.py` / `actor_critic.py` / `reinforce.py` `get_policy_snapshot` | ~4MB per run over WS, parsed on main thread mid-training | 🟠 High |
| 6 | **Bug:** `useMemo` after conditional early-return (hooks-order violation) | `QTableHeatmap.tsx:19–23` | Crash risk when first checkpoint arrives | 🟠 High |
| 7 | Heatmap = 3000 SVG rects, re-diffed on interaction | `QTableHeatmap.tsx` | Laggy hover / action toggle | 🟡 Medium |
| 8 | Checkpoint `ReferenceLine`s rebuilt inside chart per render | `RewardCurve.tsx` | Adds to per-episode diff cost | 🟡 Medium |

**Non-problems (confirmed fine):** Recharts animation already off, dots off. Tabular agent hot loops (`np.argmax` on 6 elements) are cheap. PG methods are tabular softmax — no PyTorch cost. `serialize_policy_net` in `utils/serializers.py` is dead code (no NN agents use it) — delete or ignore.

---

## Sprint P1 — Backend Streaming (1 day)

**Goal:** Training thread never blocks on sends; ≤ ~30 messages/sec regardless of episode rate; checkpoint payloads ≤ 30KB.

### P1-1: Non-blocking send + episode batching (`core/trainer.py`)
- Replace per-episode `run_coroutine_threadsafe(...).result()` with a **batch buffer** flushed every `BATCH_SIZE = 25` episodes or at end:
  ```python
  batch: list[dict] = []

  def flush(force=False):
      if batch and (force or len(batch) >= BATCH_SIZE):
          msg = {"type": "episode_batch", "episodes": batch.copy()}
          batch.clear()
          asyncio.run_coroutine_threadsafe(send(msg), loop)  # NO .result()
  ```
- Drop `.result()` — fire-and-forget. Keep `.result()` **only** for the final `training_complete` (guarantees ordering before thread exit) and optionally for checkpoints (natural backpressure so a slow client can't queue unbounded checkpoints).
- Force-flush the episode batch **before** each checkpoint send and before `training_complete` so ordering is preserved (chart never shows a checkpoint tick beyond the last plotted episode).
- Protocol: new `episode_batch` message type; keep `episode_update` fields per element unchanged, so frontend changes stay minimal.

### P1-2: Slim checkpoint snapshots (all 4 agents + `utils/serializers.py`)
- Round all floats to 4 decimals at serialization: `np.round(arr, 4).tolist()`.
- **PG agents:** stop sending `theta` — frontend only consumes `action_probs`, `greedy_policy`, `state_values`. (theta = pre-softmax logits; if you later want it for analysis, expose via a REST endpoint instead of every checkpoint.)
- Measured effect: Q 60KB → 27KB; PG 128KB → ~30KB.

### P1-3: Update `03_SPRINT_PLAN.md` / backend doc WS protocol section
- Document `episode_batch` and the slimmed snapshot schema so docs match code.

**Done criteria**
- [ ] Q-learning 3000-episode run: total WS messages ≤ 200 (was ~3030)
- [ ] Training wall-clock time drops measurably (log it before/after — expect big win from removing `.result()`)
- [ ] Checkpoint JSON ≤ 30KB for all 4 algorithms
- [ ] Cancel mid-training still works; no messages after `training_complete`

---

## Sprint P2 — Frontend State & Charts (2 days)

**Goal:** Live training at 3000 episodes stays smooth (no dropped frames while scrubbing/hovering); render count per batch = O(1), not O(components).

### P2-1: Kill the O(n²) smoothing recompute
- Delete client-side `rollingAverage` usage in `RewardCurve`, `CompareChart`, `MetricsChart` — **use the `rolling_avg_reward` the backend already sends.**
- If a client-side smoothed series is ever needed (e.g. for `td_error`), rewrite `smoothing.ts` as an **incremental running-sum** (O(1) per new point, maintained in the store, not recomputed in `useMemo`).

### P2-2: Store: batch appends + chart-ready data (`trainingStore.ts`)
- New action `appendEpisodeBatch(eps: EpisodeUpdate[])` — one `set` per batch.
- Maintain a **pre-shaped `chartData` array** in the store, appended per batch (`s.chartData.concat(newPoints)`), so charts consume it directly with zero per-render `.map()`.
- Maintain a **downsampled series**: if `episodeHistory.length > 1000`, keep a strided view (~500 points) for the raw-reward line; rolling-avg line can stay full resolution (it's smooth, path cost is what matters — stride it too if needed).
- Mirror all of this in `compareStore.ts` for runs A/B.

### P2-3: Narrow selectors everywhere
- `RewardCurve`: `useTrainingStore(s => s.chartData)`, separate selector for `checkpointEpisodes` (a plain `number[]`, memo-stable) and `finalStats`.
- `MetricsChart`: select only its metric series + `algorithm`.
- `QTableHeatmap` / `PolicyArrows` / `StateValueMap`: select **only** `checkpoints[selectedCheckpointIdx]` — must NOT re-render on episode batches.
- `useTrainingSocket`: replace `const store = useTrainingStore()` with `useTrainingStore.getState()` inside handlers (no subscription at all — the hook doesn't render anything from state). Fixes the `useCallback([store])` churn too.
- Verify with React DevTools Profiler: during training, only the two chart components re-render per batch.

### P2-4: Fix the `QTableHeatmap` hooks bug
- Move the early return **below** all hooks, or compute min/max unconditionally with a null guard. (Do this in P2 even though the canvas rewrite in P3 replaces the component — compare page timeline may ship first.)

**Done criteria**
- [ ] React Profiler: ≤ 2 components re-render per `episode_batch`
- [ ] 3000-episode live run: interaction (slider scrub, hover) stays responsive **during** training
- [ ] Compare page with two simultaneous 3000-ep runs doesn't stutter
- [ ] No client-side O(n·window) smoothing remains

---

## Sprint P3 — Heavy Visualizations (1–2 days)

**Goal:** Policy viz interactions are instant at any checkpoint count.

### P3-1: `QTableHeatmap` → canvas
- Replace 3000 `<rect>`s with a single `<canvas>`: one `fillRect` loop in a `useEffect` keyed on `[snapshot, selectedAction]`.
- Hover tooltip via `onMouseMove` → `Math.floor(y / CELL_H)` state index math — no per-cell event handlers.
- Replace `Math.min(...q.flat())` spread (6000-arg call) with a simple loop while you're in there.

### P3-2: Memoize policy grids
- `React.memo` on `PolicyArrows` + `StateValueMap`; props = the selected snapshot object (referentially stable per checkpoint) + filters.
- Pre-compute the mode-action-per-cell aggregation **once per snapshot** (memo keyed on snapshot), not per render — the 20-substate scan × 25 cells is cheap but shouldn't run on hover.

### P3-3: Checkpoint scrubbing
- Ensure `CheckpointSlider` drag only updates `selectedCheckpointIdx` (narrow selector consumers re-render); throttle to animation frame if scrubbing feels chunky with many checkpoints.

**Done criteria**
- [ ] Heatmap action-column toggle: < 16ms (single frame)
- [ ] Scrubbing 30 checkpoints back-and-forth is fluid during live training
- [ ] Hooks bug gone (P2-4 verified or component replaced)

---

## Sprint P4 — Measure, Verify, Guard (1 day)

### P4-1: Before/after benchmark script
- `backend/scripts/bench.py`: run Q-learning 3000 eps headless (send = no-op) vs through a local WS client; report eps/sec both ways. Proves P1 removed the send bottleneck.

### P4-2: Frontend perf checklist run
- Chrome Performance recording of a full 3000-ep run: main-thread long tasks < 50ms; no GC thrash from array churn.
- Compare page dual-run recording.

### P4-3: Regression guards
- Cap `episodeHistory` chart series length via downsampling (already in P2-2) — assert bounded memory for a 10,000-episode run.
- Add a `BATCH_SIZE` constant + comment in trainer so it doesn't silently regress to 1.

**Done criteria**
- [ ] Documented eps/sec: before vs after (put the numbers in the README — good research-tool credibility)
- [ ] 10,000-episode run completes without UI degradation

---

## Timeline

```
P1  Backend streaming        ─ 1 day   ─► ≤200 msgs/run, non-blocking sends, 30KB checkpoints
P2  Frontend state/charts    ─ 2 days  ─► O(1) renders per batch, no O(n²) smoothing
P3  Heavy viz                ─ 1–2 days─► canvas heatmap, memoized grids
P4  Measure + guard          ─ 1 day   ─► benchmarked, documented
                               ~5–6 days total
```

**Dependency order matters:** P1 before P2 (frontend batch handling needs `episode_batch`). P3 is independent of P1/P2 and can be parallelized. P4 last.

## Expected outcome

The lag is ~90% frontend render pressure and ~10% backend blocking. P1+P2 alone should make a 3000-episode run feel instant; tabular agents will likely train faster than the eye can follow, which is exactly the "watch it learn" experience the README promises.
