import { create } from "zustand";
import type {
  AlgorithmType,
  TrainingStatus,
  EpisodeUpdate,
  EpisodeEntry,
  Checkpoint,
  TrainingComplete,
} from "@/types";

interface TrainingStore {
  status: TrainingStatus;
  isConnected: boolean;
  algorithm: AlgorithmType;
  params: Record<string, number>;
  episodeHistory: EpisodeUpdate[];
  checkpoints: Checkpoint[];
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
  checkpoints: [],
  selectedCheckpointIdx: -1,
  finalStats: null,

  setAlgorithm: (alg) => set({ algorithm: alg }),
  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value } })),
  setParams: (params) => set({ params }),
  appendEpisode: (ep) =>
    set((s) => ({ episodeHistory: [...s.episodeHistory, ep] })),
  // P1 batch consumer — one set() per batch instead of one per episode. The
  // real chart/selector refactor happens in P2; this is just the minimal
  // adapter so the app keeps working with the new `episode_batch` protocol.
  appendEpisodeBatch: (eps) =>
    set((s) => ({
      episodeHistory: [
        ...s.episodeHistory,
        ...eps.map((e) => ({ ...e, type: "episode_update" as const })),
      ],
    })),
  appendCheckpoint: (cp) =>
    set((s) => ({
      checkpoints: [...s.checkpoints, cp],
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
      checkpoints: [],
      selectedCheckpointIdx: -1,
      finalStats: null,
    }),
}));