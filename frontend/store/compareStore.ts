import { create } from "zustand";
import type {
  EpisodeUpdate,
  EpisodeEntry,
  Checkpoint,
  TrainingComplete,
  AlgorithmType,
  TrainingStatus,
} from "@/types";

export interface RunState {
  status: TrainingStatus;
  algorithm: AlgorithmType;
  params: Record<string, number>;
  episodeHistory: EpisodeUpdate[];
  checkpoints: Checkpoint[];
  selectedCheckpointIdx: number;
  finalStats: TrainingComplete | null;
}

const defaultRun = (): RunState => ({
  status: "idle",
  algorithm: "q_learning",
  params: { alpha: 0.1, gamma: 0.99, epsilon_end: 0.01, n_episodes: 3000, checkpoint_every: 100 },
  episodeHistory: [],
  checkpoints: [],
  selectedCheckpointIdx: -1,
  finalStats: null,
});

interface CompareStore {
  runA: RunState;
  runB: RunState;
  activeMetric: "reward" | "td_error" | "loss";

  setAlgorithm: (target: "A" | "B", alg: AlgorithmType) => void;
  setParams: (target: "A" | "B", params: Record<string, number>) => void;
  appendEpisode: (target: "A" | "B", ep: EpisodeUpdate) => void;
  appendEpisodeBatch: (target: "A" | "B", eps: EpisodeEntry[]) => void;
  appendCheckpoint: (target: "A" | "B", cp: Checkpoint) => void;
  setStatus: (target: "A" | "B", s: TrainingStatus) => void;
  setFinalStats: (target: "A" | "B", stats: TrainingComplete) => void;
  setSelectedCheckpointIdx: (target: "A" | "B", idx: number) => void;
  setActiveMetric: (m: "reward" | "td_error" | "loss") => void;
  resetRun: (target: "A" | "B") => void;
  clearRunHistory: (target: "A" | "B") => void;
}

const updateRun = (
  state: CompareStore,
  target: "A" | "B",
  updater: (run: RunState) => Partial<RunState>
): Partial<CompareStore> => {
  const key = target === "A" ? "runA" : "runB";
  return { [key]: { ...state[key], ...updater(state[key]) } };
};

export const useCompareStore = create<CompareStore>((set) => ({
  runA: defaultRun(),
  runB: { ...defaultRun(), algorithm: "sarsa" },
  activeMetric: "reward",

  setAlgorithm: (t, alg) => set((s) => updateRun(s, t, () => ({ algorithm: alg }))),
  setParams: (t, params) => set((s) => updateRun(s, t, () => ({ params }))),
  appendEpisode: (t, ep) =>
    set((s) => updateRun(s, t, (r) => ({ episodeHistory: [...r.episodeHistory, ep] }))),
  // P1 batch consumer — one set() per batch. See trainingStore for rationale.
  appendEpisodeBatch: (t, eps) =>
    set((s) =>
      updateRun(s, t, (r) => ({
        episodeHistory: [
          ...r.episodeHistory,
          ...eps.map((e) => ({ ...e, type: "episode_update" as const })),
        ],
      }))
    ),
  appendCheckpoint: (t, cp) =>
    set((s) =>
      updateRun(s, t, (r) => ({
        checkpoints: [...r.checkpoints, cp],
        selectedCheckpointIdx: r.checkpoints.length,
      }))
    ),
  setStatus: (t, status) => set((s) => updateRun(s, t, () => ({ status }))),
  setFinalStats: (t, finalStats) => set((s) => updateRun(s, t, () => ({ finalStats }))),
  setSelectedCheckpointIdx: (t, idx) =>
    set((s) => updateRun(s, t, () => ({ selectedCheckpointIdx: idx }))),
  setActiveMetric: (activeMetric) => set({ activeMetric }),
  resetRun: (t) => set((s) => updateRun(s, t, () => defaultRun())),
  clearRunHistory: (t) =>
    set((s) =>
      updateRun(s, t, () => ({
        status: "idle",
        episodeHistory: [],
        checkpoints: [],
        selectedCheckpointIdx: -1,
        finalStats: null,
      }))
    ),
}));