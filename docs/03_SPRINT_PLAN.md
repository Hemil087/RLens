# RL Dashboard — Sprint Plan (Updated)

## Project Summary

Full-stack RL training analysis dashboard for Gymnasium `Taxi-v3`.
**Backend:** FastAPI + WebSockets. **Frontend:** Next.js 14 + Recharts + custom SVG.
**Algorithms:** Q-Learning, SARSA, REINFORCE (tabular softmax), Actor-Critic (tabular).
**Mode:** Fully local, no database, real-time streaming.

---

## Current Status

| Sprint | Name | Status |
|---|---|---|
| 1 | Backend Foundation | ✅ Complete |
| 2 | Frontend Shell + Live Chart | ✅ Complete |
| 3 | All 4 Algorithms (NN-based PG) | ❌ Failed — REINFORCE/AC stuck at −200 |
| **3R** | **Tabular Refactor for REINFORCE + AC** | 🔄 **Current sprint** |
| 4 | Policy Viz + Episode Replay | ⏳ Pending |
| 5 | Compare Page + Polish | ⏳ Pending |

**Root cause of Sprint 3 failure:** REINFORCE and Actor-Critic were implemented using
PyTorch neural networks (policy/value nets). On Taxi-v3's 500-state space, the NN
introduces noisy gradients, approximation error, and training instability — the agent
plateaus at ~−200 (essentially random behavior) even after 3000 episodes, while tabular
Q-learning converges to +5 in ~800 episodes.

**Fix:** Remove PyTorch entirely. Implement REINFORCE and Actor-Critic using tabular
`np.ndarray` preference tables with softmax parameterization. This is exact, interpretable,
and appropriate for the environment.

---

## Sprint 3R — Tabular Refactor (REINFORCE + Actor-Critic)

**Goal:** Replace NN-based REINFORCE and Actor-Critic with tabular implementations.
Both algorithms should converge to avg reward > +4, matching Q-learning performance.

### Tasks

**3R-1: Remove PyTorch infrastructure**
- [ ] Delete `models/policy_net.py` (PolicyNet + ValueNet classes)
- [ ] Remove `torch` from `requirements.txt`
- [ ] Add `utils/math_utils.py` with shared `softmax()` and `all_action_probs()` helpers
- [ ] Verify `pip install -r requirements.txt` succeeds without torch

**3R-2: Add `end_episode()` to BaseAgent**
- [ ] Add `end_episode(self) -> dict` to `algorithms/base.py` with default no-op
- [ ] Update trainer loop to call `agent.end_episode()` after each episode
- [ ] Q-learning and SARSA: no-op (already correct)

**3R-3: Rewrite REINFORCE as tabular**
- [ ] Replace `algorithms/reinforce.py` entirely
- [ ] Internal state: `theta: np.ndarray (500, 6)`, `W: np.ndarray (500,)`, `episode_buffer: list`
- [ ] `select_action()`: sample from `softmax(theta[s])`
- [ ] `update()`: append `(s, a, r)` to buffer, return `{}`
- [ ] `end_episode()`: compute MC returns, update W and theta, clear buffer:
  ```python
  G = 0
  for s, a, r in reversed(self.episode_buffer):
      G = r + self.gamma * G
      delta = G - self.W[s]
      self.W[s] += self.alpha_w * delta
      grad = one_hot(a) - softmax(self.theta[s])
      self.theta[s] += self.alpha_theta * delta * grad
  self.episode_buffer = []
  ```
- [ ] `get_policy_snapshot()`: return theta, all_action_probs(theta), argmax policy, W as state_values
- [ ] Test: run 3000 episodes, verify rolling avg exceeds +4 by ep ~1500

**3R-4: Rewrite Actor-Critic as tabular**
- [ ] Replace `algorithms/actor_critic.py` entirely
- [ ] Internal state: `theta: np.ndarray (500, 6)`, `V: np.ndarray (500,)`, `I: float = 1.0`
- [ ] `select_action()`: sample from `softmax(theta[s])`
- [ ] `update()`: compute TD error δ, update V[s] and theta[s] per step:
  ```python
  v_next = 0.0 if done else self.V[s_next]
  delta = r + self.gamma * v_next - self.V[s]
  self.V[s] += self.alpha_v * delta
  grad = one_hot(a) - softmax(self.theta[s])
  self.theta[s] += self.alpha_theta * self.I * delta * grad
  self.I *= self.gamma
  return {"td_error": delta, "value_loss": delta**2, "policy_loss": ...}
  ```
- [ ] `end_episode()`: reset `self.I = 1.0`
- [ ] `get_policy_snapshot()`: return theta, all_action_probs(theta), argmax policy, V as state_values
- [ ] Test: run 3000 episodes, verify rolling avg exceeds +4 by ep ~1000

**3R-5: Standardize snapshot format**
- [ ] Confirm REINFORCE and AC both return `"type": "tabular_policy"` snapshots
- [ ] Confirm snapshot schema matches:
  ```json
  {
    "type": "tabular_policy",
    "theta": [[500 rows × 6 cols]],
    "action_probs": [[500 rows × 6 cols]],
    "greedy_policy": [500 ints],
    "state_values": [500 floats]
  }
  ```
- [ ] Update `utils/serializers.py` to handle new tabular snapshot format
- [ ] Update `greedy_action()` in `gif_generator.py` (should already work via `greedy_policy` key)

**3R-6: Update `/algorithms` endpoint**
- [ ] Update REINFORCE param schema: remove NN-related params, add `alpha_theta`, `alpha_w`
- [ ] Update AC param schema: replace `alpha_theta` + `alpha_w` with `alpha_theta` + `alpha_v`
- [ ] Update algorithm descriptions to reflect tabular implementation
- [ ] Update "Research defaults" and "Fast training" preset values

**3R-7: Validation run**
- [ ] Run all 4 algorithms for 3000 episodes each
- [ ] Verify all 4 reach avg reward > +4
- [ ] Side-by-side reward curves should all converge (not just Q-learning)

**3R Done Criteria:**
- [ ] `torch` is gone from requirements.txt and codebase
- [ ] REINFORCE converges to avg reward > +4
- [ ] Actor-Critic converges to avg reward > +4
- [ ] All 4 snapshot formats correctly parsed by GIF generator and frontend

---

## Sprint 4 — Policy Visualization + Episode Replay (GIF)

**Goal:** Users can scrub checkpoints and see the learned policy visually. Users can
load any checkpoint and watch a GIF of the agent playing.

*(No changes from original Sprint 4 — tabular snapshots are simpler to serialize,
so this sprint becomes easier not harder.)*

### Tasks

**S4-1: Policy serialization**
- [ ] Implement `utils/serializers.py`
  - `serialize_q_table(Q)` → 500×6 nested list
  - `serialize_tabular_policy(theta, V)` → action_probs, state_values, greedy_policy
- [ ] Verify snapshot sizes (~24KB for any tabular snapshot)

**S4-2: Checkpoint slider**
- [ ] `components/policy/CheckpointSlider.tsx`
  - Snaps to checkpoint episode values
  - Updates `trainingStore.selectedCheckpointIdx`

**S4-3: PolicyArrows grid**
- [ ] `lib/policy-utils.ts` — `getArrowForCell()` using greedy_policy array
  - Works identically for Q-table and tabular_policy snapshots (both have `greedy_policy`)
- [ ] `components/policy/PolicyArrows.tsx`
  - 5×5 SVG grid with action arrows
  - Background intensity from max Q-value (Q-table) or max action_prob (tabular_policy)
  - Passenger/destination filter dropdowns
  - Hover tooltip

**S4-4: State value map**
- [ ] `components/policy/StateValueMap.tsx`
  - 5×5 grid, cell color = `state_values[s]` averaged across sub-states
  - Used for REINFORCE and Actor-Critic (both now provide `state_values` from W or V table)
  - Overlaid with greedy action arrow

**S4-5: Q-table heatmap**
- [ ] `components/policy/QTableHeatmap.tsx`
  - 500×6 heatmap, only shown for Q-learning and SARSA
  - For REINFORCE/AC, show `theta` preference table heatmap instead (same shape, same component)

**S4-6: GIF generator backend**
- [ ] Implement `core/gif_generator.py`
  - `generate_episode_gif(policy_snapshot, fps) → base64 str`
  - `greedy_action()` handles both `"q_table"` and `"tabular_policy"` types
  - `imageio.mimsave(..., loop=0)` for infinite GIF loop
- [ ] `POST /replay/gif` endpoint — runs in thread pool
- [ ] Test: verify GIF generates for all 4 algorithms

**S4-7: Replay page**
- [ ] `store/replayStore.ts`
- [ ] `components/replay/ReplayControls.tsx`
- [ ] `components/replay/ReplayViewer.tsx`
- [ ] `components/replay/ReplayStats.tsx`
- [ ] Wire `/replay` page

**S4 Done Criteria:**
- [ ] GIF generates for all 4 algorithm types
- [ ] PolicyArrows shows correct policy for all 4 algorithms
- [ ] StateValueMap works for both REINFORCE and Actor-Critic
- [ ] Checkpoint slider updates policy viz in real time

---

## Sprint 5 — Compare Page + Polish

**Goal:** Side-by-side comparison view. UX details. Demo-ready.

### Tasks

**S5-1: Compare store + dual WebSocket**
- [ ] `store/compareStore.ts` with two independent training substores
- [ ] `useTrainingSocket` accepts `storeTarget: "A" | "B"` param

**S5-2: CompareChart**
- [ ] Single Recharts chart with two line series (indigo = Run A, amber = Run B)
- [ ] Toggle: Raw / Smoothed
- [ ] Metric selector: Reward / TD Error / Policy Loss

**S5-3: `/compare` page**
- [ ] Two config panels side by side
- [ ] Independent Start/Stop per run
- [ ] Side-by-side PolicyArrows with episode sliders
- [ ] Interesting default pair: **Q-Learning vs Actor-Critic** (both tabular, different update mechanisms)

**S5-4: Policy diff view**
- [ ] `diffPolicies(snapshotA, snapshotB)` in `policy-utils.ts`
- [ ] Highlight differing cells in red on Compare page

**S5-5: `/policy/analyze` endpoint**
- [ ] `POST /policy/analyze` → suboptimal_action_pct, policy_entropy, q_value_spread
- [ ] Works for both snapshot types (uses `action_probs` key, present in all 4)

**S5-6: UX polish**
- [ ] Convergence marker `<ReferenceLine>` on reward chart
- [ ] Status badge transitions (idle → training → complete)
- [ ] Empty state illustrations before training starts
- [ ] Hover tooltips on all parameter sliders
- [ ] Algorithm description cards (updated to reflect tabular PG implementation)

**S5-7: Final integration test**
- [ ] All 4 algorithms train to +4 avg reward
- [ ] Compare: Q-learning vs SARSA (similar), Q-learning vs Actor-Critic (instructive)
- [ ] GIF replay visually correct for all 4
- [ ] No WS message drops at 3000 episodes

**S5 Done Criteria:**
- [ ] Compare page works with two simultaneous training runs
- [ ] All 4 algorithms' GIF replays generate correctly
- [ ] Policy diff highlighting works
- [ ] Project is demo and viva ready

---

## Milestone Summary

```
Sprint 1  ──► ✅ Backend streams Q-learning over WS
Sprint 2  ──► ✅ Frontend shows live reward curve
Sprint 3  ──► ❌ NN-based REINFORCE/AC failed (stuck at −200)
Sprint 3R ──► 🔄 Tabular refactor — fix REINFORCE/AC
Sprint 4  ──► ⏳ Policy viz + animated replay
Sprint 5  ──► ⏳ Compare page + polish
                  └── PROJECT DEMO READY
```

---

## Hyperparameter Reference (all tabular)

| Param | Q-Learning | SARSA | REINFORCE | Actor-Critic |
|---|---|---|---|---|
| α (policy lr) | 0.1 | 0.1 | 0.01 | 0.001 |
| α_v / α_w (value lr) | — | — | 0.01 | 0.01 |
| γ | 0.99 | 0.99 | 0.99 | 0.99 |
| ε start | 1.0 | 1.0 | — | — |
| ε end | 0.01 | 0.01 | — | — |

> **Why α is lower for REINFORCE and AC than Q-learning:**
> Policy gradient updates use the full preference table per step/episode. A larger
> learning rate causes overshooting and policy collapse. Start conservative and tune up.

---

## Research Extensions (Post-MVP backlog)

| Idea | Value | Effort |
|---|---|---|
| **REINFORCE with entropy bonus** — add −β·H(π) to reward, tune exploration | High | Low |
| **n-step Actor-Critic** — vary n from 1→10, visualize bias-variance tradeoff | High | Medium |
| **Policy entropy chart** — track how deterministic the policy becomes over time | High | Low |
| **Hyperparameter sweep** — run same algo with 3 different α values, overlay curves | High | Medium |
| **State visitation heatmap** — track which states are visited most during training | Medium | Low |
| **Eligibility traces TD(λ)** — shows clean interpolation between TD and MC | High | High |
| **NN comparison mode** — optionally re-enable NN-based PG for contrast with tabular | Medium | Medium |