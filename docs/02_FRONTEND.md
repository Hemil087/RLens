# RL Dashboard — Frontend Architecture

## Overview

A **Next.js 14 (App Router)** frontend that connects to the FastAPI backend via WebSockets,
renders real-time training charts, interactive policy visualizations, episode replays, and
side-by-side algorithm comparison. Built with **Recharts** for time-series plots and
**custom SVG** for the Taxi-v3 grid renderer.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | File-based routing, server components where useful |
| Styling | Tailwind CSS | Fast layout + consistent dark theme |
| Charts | Recharts | React-native, streaming-friendly, good defaults |
| State | Zustand | Lightweight global store — ideal for streaming WS data |

> **Note:** PyTorch has been removed from the backend. REINFORCE and Actor-Critic now use
> tabular NumPy implementations. The frontend is unaffected — both algorithms still emit
> `action_probs`, `greedy_policy`, and `state_values` in their snapshots, same as before.
| Icons | Lucide React | Clean, minimal |
| HTTP | Native `fetch` | REST calls + GIF fetch |
| WS | Native `WebSocket` | Wrapped in a custom hook |

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx               # Root layout — sidebar nav + global font
│   ├── page.tsx                 # Redirect → /train
│   ├── train/
│   │   └── page.tsx             # Main training page
│   ├── compare/
│   │   └── page.tsx             # Side-by-side comparison page
│   └── replay/
│       └── page.tsx             # Episode replay page (checkpoint picker + GIF player)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          # Left nav: Train / Compare / Replay
│   │   └── TopBar.tsx           # Page title + connection status badge
│   ├── training/
│   │   ├── AlgorithmSelector.tsx  # Pill/tab selector for 4 algorithms
│   │   ├── ParamPanel.tsx         # Sliders + number inputs for hyperparams
│   │   ├── TrainingControls.tsx   # Start / Stop buttons + episode progress bar
│   │   └── StatusBadge.tsx        # idle / training / complete / error states
│   ├── charts/
│   │   ├── RewardCurve.tsx        # Real-time line chart: reward per episode
│   │   ├── SmoothedRewardCurve.tsx # Rolling average overlay toggle
│   │   ├── MetricsChart.tsx       # TD error / loss over episodes
│   │   ├── EpsilonDecayChart.tsx  # Epsilon vs episode (tabular methods)
│   │   └── CompareChart.tsx       # Overlay 2 training runs on same axes
│   ├── policy/
│   │   ├── QTableHeatmap.tsx      # 500-state Q-value heatmap (tabular)
│   │   ├── PolicyArrows.tsx       # 5×5 grid with directional arrows per cell
│   │   ├── StateValueMap.tsx      # V(s) color map for PG methods
│   │   └── CheckpointSlider.tsx   # Scrub through saved checkpoints
│   ├── replay/
│   │   ├── ReplayViewer.tsx       # <img> tag displaying the base64 GIF
│   │   ├── ReplayControls.tsx     # Checkpoint picker + Load button + fps selector
│   │   └── ReplayStats.tsx        # Shows total steps + total reward for the episode
│   └── shared/
│       ├── Card.tsx               # Reusable card wrapper with title
│       ├── Toggle.tsx             # Smooth toggle switch
│       ├── Tooltip.tsx            # Hover info for params
│       └── Spinner.tsx            # Loading state
├── hooks/
│   ├── useTrainingSocket.ts     # WS connection + message dispatcher
│   └── useAlgorithmMeta.ts      # Fetch /algorithms from backend
├── store/
│   ├── trainingStore.ts         # Zustand: training run state
│   ├── compareStore.ts          # Zustand: two training runs for comparison
│   └── replayStore.ts           # Zustand: gifData, loading state, episode stats
├── lib/
│   ├── websocket.ts             # Low-level WS wrapper with reconnect logic
│   ├── policy-utils.ts          # Decode greedy_policy → arrow directions
│   └── smoothing.ts             # Rolling average for chart smoothing
└── types/
    └── index.ts                 # Shared TypeScript types
```

---

## Pages

### `/train` — Main Training Page

The primary workspace. Layout: **left panel (config) + right panel (live charts + policy viz)**.

```
┌──────────────────────────────────────────────────────────────┐
│  Sidebar │           /train                                   │
│          │  ┌─────────────────┐  ┌──────────────────────┐    │
│  Train   │  │ AlgorithmSelector│  │  RewardCurve (live)  │    │
│  Compare │  │  Q / S / R / AC  │  │  + SmoothedOverlay   │    │
│  Replay  │  ├─────────────────┤  ├──────────────────────┤    │
│          │  │   ParamPanel    │  │  MetricsChart        │    │
│          │  │  (sliders)      │  │  (loss / td_error)   │    │
│          │  ├─────────────────┤  ├──────────────────────┤    │
│          │  │ TrainingControls│  │  EpsilonDecayChart   │    │
│          │  │  [Start][Stop]  │  │  (tabular only)      │    │
│          │  │  ████░░ 2000/3k │  └──────────────────────┘    │
│          │  └─────────────────┘                               │
│          │  ┌───────────────────────────────────────────┐     │
│          │  │  CheckpointSlider  ◄ ─────────── ►        │     │
│          │  │  PolicyArrows (5×5 greedy policy grid)    │     │
│          │  └───────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

**Behavior:**
- User selects algorithm → `ParamPanel` updates to show that algorithm's
  hyperparameter controls (different params for tabular vs PG methods)
- Hit **Start** → WebSocket opens → charts begin populating in real time
- As checkpoints arrive, `CheckpointSlider` grows new tick marks
- Scrubbing the slider replaces the `PolicyArrows` grid to show policy at that episode
- For REINFORCE / Actor-Critic, `StateValueMap` replaces `PolicyArrows`
  (shows `W(s)` baseline for REINFORCE or `V(s)` critic for Actor-Critic as a color gradient
  over the 5×5 grid — both are tabular numpy arrays, not neural network outputs)

---

### `/compare` — Side-by-Side Comparison Page

Allows running **two algorithms simultaneously** (or sequentially) and comparing their
training dynamics on shared axes.

```
┌──────────────────────────────────────────────────────────┐
│  ┌───────────────────┐   ┌───────────────────────────┐   │
│  │ Run A Config       │   │  Run B Config              │   │
│  │ [Q-Learning ▼]    │   │  [Actor-Critic ▼]          │   │
│  │  α=0.1  γ=0.99    │   │   α_θ=1e-3  γ=0.99        │   │
│  │  [Start A]         │   │   [Start B]                │   │
│  └───────────────────┘   └───────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              CompareChart                            │  │
│  │  Reward ─── RunA (blue)   RunB (orange)              │  │
│  │  [Smoothing toggle]  [Metric: reward / td_error]    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌──────────────────┐   ┌──────────────────┐             │
│  │ PolicyArrows (A) │   │ PolicyArrows (B) │             │
│  │   @ ep [slider]  │   │   @ ep [slider]  │             │
│  └──────────────────┘   └──────────────────┘             │
└──────────────────────────────────────────────────────────┘
```

**Key feature:** Both runs stream simultaneously over two separate WebSocket connections.
The `CompareChart` shares a single Recharts `<LineChart>` with two `<Line>` data series
that update independently as data arrives. Users can set different episode counts per run.

---

### `/replay` — Episode Replay Page

Visualize a trained policy playing Taxi-v3 as a looping GIF using Gymnasium's native renderer.

```
┌──────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────┐  │
│  │  ReplayControls                                    │  │
│  │  Algorithm: [Q-Learning ▼]   Episode: [1000 ▼]    │  │
│  │  FPS: [4 ▼]                  [▶ Load & Play]       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ReplayViewer                                      │  │
│  │                                                    │  │
│  │      [ Spinner while POST /replay/gif loads ]      │  │
│  │               — or once loaded —                   │  │
│  │      <img src="data:image/gif;base64,..." />       │  │
│  │      (loops automatically, Gymnasium visuals)      │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ReplayStats                                       │  │
│  │  Episode steps: 18     Total reward: 7             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- User selects algorithm + checkpoint episode from dropdowns (sourced from
  `trainingStore.checkpoints[]` — only checkpoints from the current session available)
- User picks FPS: 2 / 4 / 8 — passed to backend, controls GIF playback speed
- Hit **Load & Play** → `POST /replay/gif` called with selected policy snapshot + fps
- While waiting (~0.5s): spinner shown in `ReplayViewer`
- On response: `gifData` stored in `replayStore`, rendered as `<img>` — loops infinitely
- `ReplayStats` shows episode steps + total reward returned by the backend alongside the GIF
- To compare checkpoints: user simply changes the episode dropdown and hits Load & Play again —
  new GIF replaces the old one

---

## Component Details

### `RewardCurve.tsx`

```tsx
// Data shape: { episode: number, reward: number, rollingAvg: number }[]
// Uses Recharts <LineChart> with two <Line> series:
// - "reward" (thin, low opacity, per-episode raw)
// - "rollingAvg" (thick, prominent, 100-ep mean)
// Toggle between showing both or just smoothed
// X axis: Episode number
// Y axis: Total reward per episode
// Recharts <ReferenceLine> marks checkpoint episodes with a dotted vertical line
```

The chart appends data via `useRef` to avoid full re-renders — only new data points
are pushed to the Recharts data array.

---

### `QTableHeatmap.tsx`

Renders a **500-row × 6-column heatmap** of Q-values from a checkpoint.

Since rendering 500 individual SVG rects is fine, each cell is colored by a
`d3-scale-chromatic`-inspired linear interpolator (no D3 needed — pure CSS HSL).
Color scale: blue (low Q-value) → yellow (high Q-value).

Users can:
- Select which **action column** to view (or show the `max Q` across actions)
- Toggle between absolute Q-values and **Q-value advantage** (Q[s,a] − V(s))
- This lives in the `/train` page beneath the PolicyArrows grid

---

### `PolicyArrows.tsx`

A **5×5 SVG grid** showing the greedy policy as directional arrows or icons.

```
Cell content:
- ↑ ↓ ← → = movement actions
- P = pickup
- D = dropoff

Cells also encode:
- Background color = max Q-value intensity (faint gradient)
- Border highlight = special locations (R/G/Y/B pickup/dropoff spots)
```

State-to-cell mapping uses `env_wrapper`'s decode logic mirrored in `policy-utils.ts`.
Note: a single cell (taxi_row, taxi_col) has 20 different states (5 pass_loc × 4 dest_idx).
The displayed arrow is the **mode of greedy actions** across all sub-states for that cell,
with a small "uncertainty" indicator if actions are mixed.

Users can filter by passenger location or destination using two small dropdowns
to see how the policy changes for different sub-goals.

---

### `ReplayViewer.tsx`

Displays the GIF returned by `POST /replay/gif`. Intentionally minimal.

```tsx
function ReplayViewer({ gifData, isLoading }: Props) {
  if (isLoading) return <Spinner label="Generating episode..." />;
  if (!gifData)  return <EmptyState label="Select a checkpoint and hit Load & Play" />;

  return (
    <img
      src={`data:image/gif;base64,${gifData}`}
      alt="Episode replay"
      className="rounded-lg border border-gray-700 w-full max-w-md mx-auto"
    />
  );
}
// The GIF loops automatically (loop=0 in imageio.mimsave on the backend).
// No playback controls needed — Gymnasium renders the full visual natively.
```

---

### `CheckpointSlider.tsx`

A custom range slider that:
- Snaps to checkpoint episode values only (e.g., 100, 200, ..., 3000)
- Displays the current episode value above the thumb
- Shows a "Policy at episode X" label
- Triggers a callback that updates `PolicyArrows` / `StateValueMap` 
  by selecting from the in-memory checkpoint array in Zustand store

---

## Hooks

### `useTrainingSocket.ts`

```typescript
function useTrainingSocket() {
  // Opens ws://localhost:8000/ws/train
  // Dispatches messages to Zustand trainingStore:
  //   episode_update  → append to episodeHistory[]
  //   checkpoint      → append to checkpoints[]
  //   training_complete → set status = "complete"
  // Returns: { startTraining, stopTraining, status, isConnected }
}
```

---

## State Management (Zustand)

### `trainingStore.ts`

```typescript
interface TrainingStore {
  status: "idle" | "training" | "complete" | "error"
  algorithm: AlgorithmType
  params: Record<string, number>
  episodeHistory: EpisodeUpdate[]      // grows as training streams in
  checkpoints: Checkpoint[]            // grows as checkpoints arrive
  selectedCheckpointIdx: number        // which checkpoint the user is viewing
  finalStats: TrainingComplete | null
}
```

### `compareStore.ts`

```typescript
interface CompareStore {
  runA: TrainingStore  // embedded training store for run A
  runB: TrainingStore  // embedded training store for run B
  activeMetric: "reward" | "td_error" | "loss"
}
```

### `replayStore.ts`

```typescript
interface ReplayStore {
  gifData: string | null    // base64 GIF string from POST /replay/gif
  isLoading: boolean        // true while fetch is in progress
  totalSteps: number | null // returned by backend alongside GIF
  totalReward: number | null
  fps: number               // user-selected: 2 | 4 | 8
}
```

---

## Styling & Theme

Dark research dashboard aesthetic. Key Tailwind color usage:

```
Background:   bg-gray-950   (#0a0a0f)
Card surface: bg-gray-900   (#111118)
Border:       border-gray-800
Primary:      #6366f1  (indigo-500)  — used for buttons, Run A line
Accent:       #f59e0b  (amber-500)   — used for Run B line, highlights
Success:      #22c55e  (green-500)   — episode complete flash
Text primary: text-gray-100
Text muted:   text-gray-400
```

Charts:
- Recharts background: `transparent`
- Grid lines: `stroke="#1f2937"` (very subtle)
- Axis labels: `#9ca3af` (gray-400)
- Tooltip: dark glass-morphism card

---

## Key UX Interactions

1. **Parameter presets** — Each algorithm has a "Research defaults" and "Fast training"
   preset button that fills the param panel to sensible values. No hunting for settings.

2. **Live episode counter** — A large number display (`2,341 / 3,000`) above the chart
   ticks up in real time. More visceral than a progress bar alone.

3. **Checkpoint timeline** — Under the main reward chart, a horizontal timeline shows
   dots at each checkpoint. Clicking any dot jumps the policy viz to that snapshot.

4. **Convergence marker** — A vertical `<ReferenceLine>` appears automatically when
   the `training_complete` message reports `convergence_episode`. Annotated with
   "Converged ~ep 1450".

5. **Policy diff mode** (bonus) — In the `/train` page, a "Compare to episode X" toggle
   shows the PolicyArrows grid with cells highlighted in red where the policy changed
   between two checkpoints. Good for visualizing how the policy evolves.

6. **Replay GIF loading indicator** — When loading a replay, a centered spinner with
   "Generating episode..." text appears inside the `ReplayViewer` card. The Load & Play
   button shows a loading state and is disabled until the GIF arrives (~0.5s).

---

## Local Dev Setup

```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:3000
```

```json
// next.config.ts — proxy API calls to avoid CORS in dev
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "http://localhost:8000/:path*" }
  ]
}
```

WebSocket connects directly to `ws://localhost:8000` (not proxied — Next.js doesn't proxy WS).

---

## package.json Dependencies

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "recharts": "^2.12",
    "zustand": "^4",
    "lucide-react": "^0.383",
    "tailwindcss": "^3",
    "clsx": "^2"
  }
}
```