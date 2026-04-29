# RL Dashboard — Backend Architecture

## Overview

A **FastAPI** backend that trains RL agents on the Gymnasium `Taxi-v3` environment and streams
training telemetry and policy checkpoints to the frontend via **WebSockets**. Episode replays
are generated as **GIF files** using Gymnasium's built-in `rgb_array` renderer and returned
to the frontend as base64-encoded strings via a REST endpoint. No database. All state lives
in memory for the lifetime of a training session.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | FastAPI | Async-native, WebSocket support built-in |
| RL Environment | `gymnasium` (Taxi-v3) | Standard, small (500 states × 6 actions) |
| ~~Neural Networks~~ | ~~PyTorch~~ | **Removed** — tabular methods sufficient for Taxi-v3 |
| Numerical | NumPy | Q-tables, theta tables, reward buffers |
| Concurrency | `asyncio` + `threading` | Non-blocking WebSocket + training thread |
| Python | 3.11+ | |

> **Design decision:** REINFORCE and Actor-Critic use **tabular parameterizations**
> (softmax over preference tables) instead of neural networks. Taxi-v3 has only 500
> discrete states — a neural network introduces approximation error, training instability,
> and convergence failure where none is needed. All 4 algorithms use exact tabular
> representations for a fair, interpretable comparison.

---

## Project Structure

```
backend/
├── main.py                  # FastAPI app, CORS, WebSocket router, REST endpoints
├── requirements.txt
├── core/
│   ├── env_wrapper.py       # Taxi-v3 wrapper with decode utilities
│   ├── trainer.py           # Master training loop, checkpoint logic
│   └── gif_generator.py     # GIF generation from policy snapshot using rgb_array
├── algorithms/
│   ├── base.py              # Abstract Agent interface
│   ├── q_learning.py        # Tabular Q-learning
│   ├── sarsa.py             # Tabular SARSA
│   ├── reinforce.py         # Tabular REINFORCE — softmax over θ(s,a) table
│   └── actor_critic.py      # Tabular one-step Actor-Critic — θ(s,a) + V(s)
├── models/
│   └── schemas.py           # Pydantic request/response schemas (policy_net.py removed)
└── utils/
    ├── serializers.py       # Serialize tables → JSON-safe dicts
    └── stats.py             # Rolling average, smoothing helpers
```

> **`models/policy_net.py` has been removed.** No neural network classes are used.

---

## Environment Wrapper — `core/env_wrapper.py`

Wraps `gymnasium.make("Taxi-v3")` and exposes clean helpers used by all algorithms.

### Key responsibilities

- `reset()` / `step(action)` — thin wrappers that return typed tuples
- `decode_state(s) → TaxiState` — converts the integer state (0–499) into a readable
  struct:
  ```python
  @dataclass
  class TaxiState:
      taxi_row: int      # 0–4
      taxi_col: int      # 0–4
      pass_loc: int      # 0–4  (0=R,1=G,2=Y,3=B, 4=in taxi)
      dest_idx: int      # 0–3  (R,G,Y,B)
  ```
  Internally uses `env.unwrapped.decode(s)` from Gymnasium.
- `make_render_env()` — creates a **separate** env instance with `render_mode="rgb_array"`
  used exclusively by `gif_generator.py`. The training env and render env are kept separate
  to avoid render overhead during training.
- Constants exposed: `N_STATES = 500`, `N_ACTIONS = 6`, action name map
  `{0:"south", 1:"north", 2:"east", 3:"west", 4:"pickup", 5:"dropoff"}`.

---

## Abstract Agent — `algorithms/base.py`

```python
class BaseAgent(ABC):
    @abstractmethod
    def select_action(self, state: int) -> int: ...

    @abstractmethod
    def update(self, state, action, reward, next_state, done) -> dict: ...
    # returns a dict of any per-step metrics (loss, td_error, etc.)

    def end_episode(self) -> None:
        pass
    # Default: no-op. REINFORCE overrides this to trigger MC return computation
    # after the full episode trajectory is collected.

    @abstractmethod
    def get_policy_snapshot(self) -> dict: ...
    # returns a JSON-serializable dict describing current policy

    @abstractmethod
    def get_config(self) -> dict: ...
    # returns hyper-params used, for logging
```

All agents implement this interface so the trainer is algorithm-agnostic.

---

## Algorithm Implementations

### 1. Q-Learning — `algorithms/q_learning.py`

**Reference:** Sutton & Barto, Ch. 6.5

**Configurable parameters (sent from frontend):**

| Parameter | Default | Range |
|---|---|---|
| `alpha` (learning rate) | 0.1 | 0.001 – 1.0 |
| `gamma` (discount) | 0.99 | 0.8 – 1.0 |
| `epsilon_start` | 1.0 | fixed |
| `epsilon_end` | 0.01 | 0.001 – 0.1 |
| `epsilon_decay` | linear over episodes | — |
| `n_episodes` | 3000 | 500 – 10000 |
| `checkpoint_every` | 100 | 50 – 500 |

**Internal state:** `Q: np.ndarray shape (500, 6)` initialized to zeros.

**Update rule:**
```
Q[s,a] ← Q[s,a] + α · [r + γ · max_a' Q[s',a'] − Q[s,a]]
```

**`get_policy_snapshot()`** returns:
```json
{
  "type": "q_table",
  "q_table": [[...500 rows, 6 cols...]],
  "greedy_policy": [best_action_per_state × 500]
}
```

---

### 2. SARSA — `algorithms/sarsa.py`

**Reference:** Sutton & Barto, Ch. 6.4

Same configurable parameters as Q-learning, plus same Q-table structure.

**Update rule (on-policy TD):**
```
Q[s,a] ← Q[s,a] + α · [r + γ · Q[s',a'] − Q[s,a]]
```
where `a'` is the *actual next action* chosen by the epsilon-greedy policy,
not the max. This is the key behavioral difference from Q-learning that makes
SARSA a meaningful research comparison.

**`get_policy_snapshot()`** — identical format to Q-learning, allowing
direct Q-value comparison overlays on the frontend.

---

### 3. REINFORCE — `algorithms/reinforce.py` ← REFACTORED: Tabular

**Reference:** Sutton & Barto, Ch. 13.3–13.4

**What changed:** Replaced `PolicyNet` + `ValueNet` (PyTorch) with a direct
`np.ndarray` preference table. No neural network, no autograd, no approximation error.

**Configurable parameters:**

| Parameter | Default | Range |
|---|---|---|
| `alpha_theta` (policy lr) | 0.01 | 1e-4 – 0.1 |
| `alpha_w` (baseline lr) | 0.01 | 1e-4 – 0.1 |
| `gamma` | 0.99 | 0.8 – 1.0 |
| `n_episodes` | 3000 | 500 – 10000 |
| `checkpoint_every` | 100 | 50 – 500 |

**Internal state:**
```python
theta: np.ndarray   # shape (500, 6) — action preference parameters
W:     np.ndarray   # shape (500,)   — baseline (state value) parameters
```

Both initialized to zeros.

**Policy (softmax over preferences):**
```python
def softmax(x):
    e = np.exp(x - np.max(x))   # numerically stable
    return e / e.sum()

def pi(s):
    return softmax(theta[s])     # shape (6,) — probability over actions
```

**Action selection:**
```python
def select_action(self, state):
    probs = pi(state)
    return np.random.choice(6, p=probs)
```

**`update()` — buffer the transition (no update yet):**
```python
def update(self, s, a, r, s_next, done):
    self.episode_buffer.append((s, a, r))
    return {}   # no per-step metrics for REINFORCE
```

**`end_episode()` — compute MC returns and update:**
```python
def end_episode(self):
    G = 0
    policy_losses = []
    for s, a, r in reversed(self.episode_buffer):
        G = r + self.gamma * G
        baseline = self.W[s]
        delta = G - baseline

        # Baseline update
        self.W[s] += self.alpha_w * delta

        # Policy gradient: ∇log π(a|s) = 1(a==a_t) - π(a|s)
        grad = np.zeros(6)
        grad[a] = 1.0
        grad -= pi(s)
        self.theta[s] += self.alpha_theta * delta * grad

        policy_losses.append(-np.log(pi(s)[a] + 1e-8) * delta)

    self.episode_buffer = []
    return {"policy_loss": np.mean(policy_losses)}
```

**`get_policy_snapshot()`** returns:
```json
{
  "type": "tabular_policy",
  "theta": [[...500 rows, 6 cols...]],
  "action_probs": [[...500 rows, 6 cols...]],
  "greedy_policy": [argmax per state × 500],
  "state_values": [...500 floats from W...]
}
```

---

### 4. Actor-Critic — `algorithms/actor_critic.py` ← REFACTORED: Tabular

**Reference:** Sutton & Barto, Ch. 13.5 — "One-step Actor-Critic"

**What changed:** Replaced `PolicyNet` + `ValueNet` (PyTorch) with tabular
`theta` (actor) and `V` (critic) numpy arrays. Updates every step — no episode buffer needed.

**Configurable parameters:**

| Parameter | Default | Range |
|---|---|---|
| `alpha_theta` (actor lr) | 0.001 | 1e-5 – 0.01 |
| `alpha_v` (critic lr) | 0.01 | 1e-4 – 0.1 |
| `gamma` | 0.99 | 0.8 – 1.0 |
| `n_episodes` | 3000 | 500 – 10000 |
| `checkpoint_every` | 100 | 50 – 500 |

**Internal state:**
```python
theta: np.ndarray   # shape (500, 6) — actor (policy) parameters
V:     np.ndarray   # shape (500,)   — critic (state value) parameters
I:     float        # discount accumulator, reset to 1.0 each episode
```

Both `theta` and `V` initialized to zeros.

**`update()` — online update every step:**
```python
def update(self, s, a, r, s_next, done):
    v_next = 0.0 if done else self.V[s_next]
    delta = r + self.gamma * v_next - self.V[s]   # TD error

    # Critic update
    self.V[s] += self.alpha_v * delta

    # Actor update: ∇log π(a|s) = 1(a==a_t) - π(a|s)
    grad = np.zeros(6)
    grad[a] = 1.0
    grad -= softmax(self.theta[s])
    self.theta[s] += self.alpha_theta * self.I * delta * grad

    self.I *= self.gamma   # discount accumulator

    return {
        "td_error": delta,
        "value_loss": delta ** 2,
        "policy_loss": -np.log(softmax(self.theta[s])[a] + 1e-8) * delta
    }
```

**`end_episode()`:**
```python
def end_episode(self):
    self.I = 1.0   # reset discount accumulator
```

**Key advantage over REINFORCE:**
- Updates every step (online) → lower variance
- No episode buffer → memory efficient
- TD error δ = immediate credit assignment vs Monte Carlo return

**`get_policy_snapshot()`** returns:
```json
{
  "type": "tabular_policy",
  "theta": [[...500 rows, 6 cols...]],
  "action_probs": [[...500 rows, 6 cols...]],
  "greedy_policy": [argmax per state × 500],
  "state_values": [...500 floats from V...]
}
```

> **Note:** `get_policy_snapshot()` format is **identical** for REINFORCE and Actor-Critic.
> The frontend uses the same `StateValueMap` and `PolicyArrows` components for both.

---

## Shared Softmax Utility — `utils/math_utils.py`

```python
import numpy as np

def softmax(x: np.ndarray) -> np.ndarray:
    """Numerically stable softmax over a 1D array."""
    e = np.exp(x - np.max(x))
    return e / e.sum()

def all_action_probs(theta: np.ndarray) -> np.ndarray:
    """Apply softmax to every row of theta. Returns (500, 6) array."""
    return np.array([softmax(theta[s]) for s in range(500)])
```

---

## Trainer — `core/trainer.py`

The trainer is the central orchestrator. Instantiated per WebSocket connection.

### Training loop

```python
for episode in range(n_episodes):
    state, _ = env.reset()
    total_reward, steps = 0, 0
    done = False
    agent.I = 1.0 if hasattr(agent, 'I') else None   # reset AC accumulator

    while not done:
        action = agent.select_action(state)
        next_state, reward, terminated, truncated, _ = env.step(action)
        done = terminated or truncated
        metrics = agent.update(state, action, reward, next_state, done)
        state = next_state
        total_reward += reward
        steps += 1

    agent.end_episode()   # REINFORCE: triggers MC update; others: no-op (or reset I)

    await ws.send_json(episode_update_msg(episode, total_reward, steps, metrics))

    if (episode + 1) % checkpoint_every == 0:
        snapshot = agent.get_policy_snapshot()
        await ws.send_json(checkpoint_msg(episode + 1, snapshot))

await ws.send_json(training_complete_msg(summary_stats))
```

---

## GIF Generator — `core/gif_generator.py`

Unchanged from original design. Works with all 4 snapshot formats via `greedy_action()`:

```python
def greedy_action(policy_snapshot: dict, state: int) -> int:
    """Works for both q_table and tabular_policy snapshot types."""
    if policy_snapshot["type"] == "q_table":
        return int(np.argmax(policy_snapshot["q_table"][state]))
    elif policy_snapshot["type"] == "tabular_policy":
        return int(policy_snapshot["greedy_policy"][state])
```

---

## WebSocket Protocol

### Message Types: Client → Server

```jsonc
{
  "type": "start_training",
  "algorithm": "reinforce",   // "q_learning" | "sarsa" | "reinforce" | "actor_critic"
  "params": {
    "alpha_theta": 0.01,
    "alpha_w": 0.01,
    "gamma": 0.99,
    "n_episodes": 3000,
    "checkpoint_every": 100
  }
}
```

### Message Types: Server → Client

```jsonc
// Every episode
{
  "type": "episode_update",
  "episode": 150,
  "reward": 8,
  "steps": 42,
  "rolling_avg_reward": 3.4,
  "extra_metrics": {
    // Q-learning / SARSA:
    "td_error": 0.12,
    "epsilon": 0.85
    // REINFORCE (emitted from end_episode):
    // "policy_loss": 0.34
    // Actor-Critic (emitted per step, averaged):
    // "td_error": 0.08, "policy_loss": 0.21, "value_loss": 0.04
  }
}

// Every checkpoint_every episodes
{
  "type": "checkpoint",
  "episode": 1000,
  "policy_snapshot": {
    // Q-learning / SARSA:
    "type": "q_table",
    "q_table": [...],
    "greedy_policy": [...]
    // REINFORCE / Actor-Critic:
    // "type": "tabular_policy",
    // "theta": [...], "action_probs": [...],
    // "greedy_policy": [...], "state_values": [...]
  }
}
```

---

## REST Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/env/info` | Return action names and algorithm metadata |
| `POST` | `/replay/gif` | Generate episode GIF — accepts policy snapshot, returns base64 GIF |
| `POST` | `/policy/analyze` | Policy entropy, suboptimal action %, Q-value spread |
| `GET` | `/algorithms` | Return metadata for all 4 algorithms (name, params schema, description) |

---

## Expected Convergence (tabular, all methods)

| Algorithm | Convergence (episodes) | Final Avg Reward | Notes |
|---|---|---|---|
| Q-Learning | ~500–1000 | +5 to +8 | Fast; off-policy |
| SARSA | ~700–1200 | +4 to +7 | Conservative; on-policy |
| REINFORCE | ~1000–2000 | +4 to +7 | MC returns; higher variance |
| Actor-Critic | ~500–1500 | +5 to +8 | Online TD; lower variance than REINFORCE |

---

## requirements.txt

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
gymnasium>=0.29.0
numpy>=1.26.0
pydantic>=2.0.0
websockets>=12.0
imageio>=2.34.0
pygame>=2.5.0        # required by gymnasium's rgb_array renderer for Taxi-v3
```

> **`torch` has been removed.** All 4 algorithms now use only NumPy.