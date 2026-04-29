# RLens 🔬

> A research-grade training analysis dashboard for Reinforcement Learning on the Gymnasium `Taxi-v4` environment.

RLens lets you train RL agents, watch their policy evolve in real time, compare algorithms side by side, and replay learned behaviors as GIFs — all from a clean interactive dashboard.

---

## What it does

Train an agent. Watch it learn. Understand *why*.

RLens streams live training telemetry from the backend to the browser via WebSockets. As your agent trains over thousands of episodes, you see the reward curve update in real time, policy snapshots get captured at regular checkpoints, and at any point you can load a checkpoint and watch a GIF of the agent playing the environment using Gymnasium's native visual renderer.

The goal is not just to train — it's to **analyze**. Scrub back to episode 500 and compare the policy to episode 2500. Run Q-learning and Actor-Critic simultaneously and overlay their reward curves. See where the policy changed between checkpoints.

---

## Algorithms

All four algorithms use **tabular representations** — exact lookup tables over the
500-state space, no neural network approximation. This makes every algorithm directly
comparable on equal footing, and makes the policy visualizations fully interpretable.

| Algorithm | Type | Parameterization | Reference |
|---|---|---|---|
| **Q-Learning** | Off-policy TD control | Q-table `(500×6)` | Sutton & Barto, Ch. 6.5 |
| **SARSA** | On-policy TD control | Q-table `(500×6)` | Sutton & Barto, Ch. 6.4 |
| **REINFORCE** | Monte Carlo policy gradient | Softmax over `θ(s,a)` table `(500×6)` + baseline `W(s)` | Sutton & Barto, Ch. 13.4 |
| **Actor-Critic** | Online one-step policy gradient | Softmax over `θ(s,a)` + value table `V(s)` | Sutton & Barto, Ch. 13.5 |

### Why no neural networks?

REINFORCE and Actor-Critic are parameterized policy methods — they only require a
*differentiable* policy representation. On a 500-state discrete environment like Taxi-v4,
a tabular softmax policy (`θ` table + softmax) satisfies this requirement exactly:

- **Exact representation** — no approximation error
- **Stable learning** — no vanishing gradients or bad initialization
- **Fully interpretable** — policy weights are directly readable
- **Fair comparison** — all 4 algorithms use the same data structure class (numpy tables)

All hyperparameters are configurable from the UI before training starts.

---

## Features

**Live Training**
- Real-time reward curve with raw + smoothed (100-ep rolling average) overlay
- Algorithm-specific metrics: TD error for tabular methods, policy/value loss for PG methods
- Epsilon decay chart for Q-Learning and SARSA
- Episode counter and progress bar
- Start / Stop training at any time

**Policy Visualization**
- Checkpoint timeline — scrub through snapshots at any episode
- 5×5 PolicyArrows grid — greedy action per cell with intensity background
- Passenger/destination filter to inspect sub-goal-specific policies
- State Value Map — `V(s)` / `W(s)` color map for REINFORCE and Actor-Critic
- Preference heatmap — `θ(s,a)` table visualization for PG methods (mirrors Q-table heatmap)

**Episode Replay**
- Select any checkpoint → generate a GIF of the agent playing greedily
- Uses Gymnasium's native `rgb_array` renderer — the real Taxi-v3 visual
- GIF loops automatically in the browser
- Episode stats: total steps and total reward shown alongside the GIF

**Algorithm Comparison**
- Run two algorithms simultaneously on separate WebSocket connections
- Overlay reward curves on shared axes (indigo vs amber)
- Side-by-side policy grids at user-selected checkpoints
- Policy diff view: highlights cells where the two policies disagree

---

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async framework, WebSocket support
- [Gymnasium](https://gymnasium.farama.org/) — Taxi-v4 environment
- [NumPy](https://numpy.org/) — all algorithm tables (Q, θ, V, W)
- [imageio](https://imageio.readthedocs.io/) + [pygame](https://www.pygame.org/) — GIF generation from `rgb_array` frames

> **No PyTorch.** All algorithms are tabular — NumPy is sufficient.

**Frontend**
- [Next.js 14](https://nextjs.org/) (App Router)
- [Recharts](https://recharts.org/) — real-time training charts
- [Zustand](https://zustand-demo.pmnd.rs/) — global state for streaming data
- [Tailwind CSS](https://tailwindcss.com/) — dark dashboard theme
- Custom SVG — policy arrow grids and value heatmaps

---

## Project Structure

```
rlens/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── core/
│   │   ├── env_wrapper.py       # Taxi-v4 wrapper + decode utilities
│   │   ├── trainer.py           # Training loop + WebSocket streaming
│   │   └── gif_generator.py     # Episode GIF generation via rgb_array
│   ├── algorithms/
│   │   ├── base.py              # Abstract BaseAgent (includes end_episode hook)
│   │   ├── q_learning.py        # Tabular Q-learning
│   │   ├── sarsa.py             # Tabular SARSA
│   │   ├── reinforce.py         # Tabular REINFORCE — softmax θ(s,a) + baseline W(s)
│   │   └── actor_critic.py      # Tabular Actor-Critic — θ(s,a) + V(s)
│   ├── models/
│   │   └── schemas.py           # Pydantic schemas (policy_net.py removed)
│   └── utils/
│       ├── math_utils.py        # softmax, all_action_probs
│       ├── serializers.py
│       └── stats.py
└── frontend/
    ├── app/
    │   ├── train/page.tsx
    │   ├── compare/page.tsx
    │   └── replay/page.tsx
    ├── components/
    │   ├── training/
    │   ├── charts/
    │   ├── policy/
    │   ├── replay/
    │   └── shared/
    ├── hooks/
    ├── store/
    └── lib/
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+

### 1. Clone the repository

```bash
git clone https://github.com/your-username/rlens.git
cd rlens
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend runs at `http://localhost:8000`. Verify with:
```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Usage

### Training an agent

1. Open `http://localhost:3000/train`
2. Select an algorithm (Q-Learning, SARSA, REINFORCE, or Actor-Critic)
3. Adjust hyperparameters using the sliders, or click **Research defaults**
4. Click **Start** — the reward curve begins updating live
5. Checkpoints are captured automatically every N episodes (configurable)

### Viewing policy snapshots

- Drag the **Checkpoint Slider** below the reward chart to scrub through episodes
- The PolicyArrows grid updates to show the greedy policy at that episode
- For REINFORCE / Actor-Critic, the State Value Map shows `W(s)` or `V(s)` respectively
- Use the passenger/destination dropdowns to filter sub-goal-specific behavior

### Replaying an episode

1. Navigate to `/replay`
2. Select the algorithm and checkpoint episode from the dropdowns
3. Choose a playback FPS (2 / 4 / 8)
4. Click **Load & Play** — a GIF of the agent playing will appear in ~0.5 seconds

### Comparing algorithms

1. Navigate to `/compare`
2. Configure Run A and Run B independently
3. Start both runs — reward curves overlay on shared axes in real time
4. Recommended pair: **Q-Learning vs Actor-Critic** — same convergence speed,
   different update mechanisms, interesting policy differences

---

## Environment

**Gymnasium `Taxi-v4`**
- 5×5 grid world, 500 discrete states, 6 actions
- 4 fixed locations: R (red), G (green), Y (yellow), B (blue)
- Agent picks up a passenger from one location and drops them at another
- Reward: −1 per step, −10 for illegal pickup/dropoff, +20 for successful delivery
- Episode truncated at 200 steps

| | Random policy | Trained policy (all 4 algorithms) |
|---|---|---|
| Avg steps/episode | ~200 (truncated) | ~13 |
| Avg reward/episode | ~−200 | ~+5 to +8 |

---

## Approximate Convergence (tabular)

| Algorithm | ~Convergence episode | Notes |
|---|---|---|
| Q-Learning | 500–1000 | Fast; off-policy, overestimates early |
| SARSA | 700–1200 | Conservative; on-policy, safer behavior |
| REINFORCE | 1000–2000 | MC returns; higher variance, baseline reduces it |
| Actor-Critic | 500–1500 | Online TD updates; lower variance than REINFORCE |

> All four algorithms are expected to reach avg reward > +4. The reward curves are
> meaningfully different (convergence speed, variance) even though the final performance
> is similar — this is the interesting part to visualize.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/algorithms` | Algorithm metadata + parameter schemas |
| `POST` | `/replay/gif` | Generate episode GIF from policy snapshot |
| `POST` | `/policy/analyze` | Policy entropy, suboptimal action %, value spread |
| `WS` | `/ws/train` | Stream training telemetry + checkpoints |

### WebSocket training message flow

```
Client → { type: "start_training", algorithm: "actor_critic", params: {...} }

Server → { type: "episode_update", episode: 150, reward: 8, rolling_avg_reward: 3.4, ... }
Server → { type: "checkpoint",     episode: 500, policy_snapshot: { type: "tabular_policy", ... } }
Server → { type: "training_complete", convergence_episode: 800, ... }
```

---

## Research Notes

A few behaviors worth looking for across algorithms on Taxi-v3:

- **Q-learning vs SARSA**: Q-learning converges faster but SARSA develops a more cautious
  policy near illegal pickup/dropoff cells. Visible in the PolicyArrows grid.

- **REINFORCE variance**: The raw reward curve for REINFORCE is noticeably noisier than
  tabular TD methods. Toggle the smoothed overlay to see the underlying trend.
  The baseline `W(s)` reduces variance significantly — try disabling it (set `alpha_w=0`)
  and compare.

- **Actor-Critic vs REINFORCE**: Actor-Critic's curve rises more steadily — online TD
  updates mean every step contributes immediately rather than waiting for episode end.

- **θ table evolution**: For REINFORCE and Actor-Critic, the preference heatmap
  (`θ(s,a)` table) shows which actions are being suppressed vs amplified per state.
  At early checkpoints it is near-zero (uniform policy). At convergence, you see
  strong preferences for movement actions and low preferences for pickup/dropoff
  in irrelevant states.

- **Policy at early checkpoints**: Load a checkpoint from episode 200 — the policy is
  largely random. At episode 600 it starts showing directional structure. At episode
  1500+ it typically looks near-optimal for all 4 algorithms.

---

## Acknowledgements

Environment: [Gymnasium Taxi-v4](https://gymnasium.farama.org/environments/toy_text/taxi/) by Farama Foundation.

Algorithm references: Sutton, R. S., & Barto, A. G. (2018). *Reinforcement Learning: An Introduction* (2nd ed.). MIT Press. — [Free PDF](http://incompleteideas.net/book/the-book-2nd.html)
