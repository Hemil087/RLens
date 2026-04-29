import { create } from "zustand";

interface ReplayStore {
  gifData: string | null;
  isLoading: boolean;
  totalSteps: number | null;
  totalReward: number | null;
  fps: number;

  setGifData: (data: string, steps: number, reward: number) => void;
  setLoading: (v: boolean) => void;
  setFps: (fps: number) => void;
  reset: () => void;
}

export const useReplayStore = create<ReplayStore>((set) => ({
  gifData: null,
  isLoading: false,
  totalSteps: null,
  totalReward: null,
  fps: 4,

  setGifData: (gifData, totalSteps, totalReward) =>
    set({ gifData, totalSteps, totalReward, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setFps: (fps) => set({ fps }),
  reset: () => set({ gifData: null, isLoading: false, totalSteps: null, totalReward: null }),
}));
