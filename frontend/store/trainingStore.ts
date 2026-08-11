import { create } from "zustand";
import type {
  AlgorithmType,
  TrainingStatus,
  EpisodeUpdate,
  EpisodeEntry,
  ChartPoint,
  Checkpoint,
  TrainingComplete,
} from "@/types";

// Turn a wire-format episode into a chart-ready row. Runs once at insertion
// so charts read the store directly with no per-render transforms.
function toChartPoint(e: EpisodeEntry | EpisodeUpdate): ChartPoint {
  return {
    episode: e.episode,
    reward: e.reward,
    rollingAvg: e.rolling_avg_reward,
    td_error: e.extra_metrics?.td_error,
    policy_loss: e.extra_metrics?.policy_loss,
    value_loss: e.extra_metrics?.value_loss,
    epsilon: e.epsilon,
  };
}

interface TrainingStore {
  status: TrainingStatus;
  isConnected: boolean;
  algorithm: AlgorithmType;
  params: Record<string, number>;

  // Raw wire data. Kept for the replay page (checkpoint dropdowns) and any
  // component that still wants full episode records. Chart components must
  // NOT read this — they read `chartData` instead.
  episodeHistory: EpisodeUpdate[];

  // P2: pre-shaped chart data. Extended once per batch; charts subscribe to
  // this and this alone, so heavy sibling components (heatmap, policy grid)
  // do not re-render when new episodes arrive.
  chartData: ChartPoint[];

  checkpoints: Checkpoint[];
  // P2: extracted for RewardCurve's ReferenceLine ticks. Referentially stable
  // between checkpoints so the chart doesn't diff N ReferenceLine elements
  // on every batch.
  checkpointEpisodes: number[];

  selectedCheckpointIdx: number;
  finalStats: TrainingComplete | null;

  setAlgorithm: (alg: AlgorithmType) => void;
  setParam: (key: string, value: number) => void;
  setParams: (params: Record<string, number>) => void;
  appendEpisode: (ep: EpisodeUpdate) => void;
  appendEpisodeBatch: (eps: EpisodeEntry[]) => void;
  appendCheckpoint: (cp: Checkpoint) => void;
  setStatus: (s: TrainingStatus) => void;
  setIsConnected: (v: boolean) => void;
  setFinalStats: (stats: TrainingComplete) => void;
  setSelectedCheckpointIdx: (idx: number) => void;
  reset: () => void;
}

const defaultParams: Record<string, number> = {
  alpha: 0.1,
  gamma: 0.99,
  epsilon_end: 0.01,
  n_episodes: 3000,
  checkpoint_every: 100,
};

export const useTrainingStore = create<TrainingStore>((set) => ({
  status: "idle",
  isConnected: false,
  algorithm: "q_learning",
  params: defaultParams,
  episodeHistory: [],
  chartData: [],
  checkpoints: [],
  checkpointEpisodes: [],
  selectedCheckpointIdx: -1,
  finalStats: null,

  setAlgorithm: (alg) => set({ algorithm: alg }),
  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value } })),
  setParams: (params) => set({ params }),

  appendEpisode: (ep) =>
    set((s) => ({
      episodeHistory: [...s.episodeHistory, ep],
      chartData: [...s.chartData, toChartPoint(ep)],
    })),

  // One set() call per batch — the wire array and the chart array grow
  // together so subscribers see a single, consistent snapshot.
  appendEpisodeBatch: (eps) =>
    set((s) => ({
      episodeHistory: [
        ...s.episodeHistory,
        ...eps.map((e) => ({ ...e, type: "episode_update" as const })),
      ],
      chartData: [...s.chartData, ...eps.map(toChartPoint)],
    })),

  appendCheckpoint: (cp) =>
    set((s) => ({
      checkpoints: [...s.checkpoints, cp],
      checkpointEpisodes: [...s.checkpointEpisodes, cp.episode],
      selectedCheckpointIdx: s.checkpoints.length,
    })),

  setStatus: (status) => set({ status }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setFinalStats: (finalStats) => set({ finalStats }),
  setSelectedCheckpointIdx: (idx) => set({ selectedCheckpointIdx: idx }),

  reset: () =>
    set({
      status: "idle",
      isConnected: false,
      episodeHistory: [],
      chartData: [],
      checkpoints: [],
      checkpointEpisodes: [],
      selectedCheckpointIdx: -1,
      finalStats: null,
    }),
}));