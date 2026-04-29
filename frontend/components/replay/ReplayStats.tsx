"use client";
import { useReplayStore } from "@/store/replayStore";

export function ReplayStats() {
  const { totalSteps, totalReward } = useReplayStore();
  if (totalSteps === null) return null;

  return (
    <div className="flex gap-6">
      <div className="text-center">
        <div className="text-2xl font-bold text-indigo-400 font-mono">{totalSteps}</div>
        <div className="text-xs text-gray-500">Episode steps</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-amber-400 font-mono">{totalReward}</div>
        <div className="text-xs text-gray-500">Total reward</div>
      </div>
    </div>
  );
}
