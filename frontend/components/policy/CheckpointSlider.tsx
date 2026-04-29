"use client";
import { useTrainingStore } from "@/store/trainingStore";

export function CheckpointSlider() {
  const { checkpoints, selectedCheckpointIdx, setSelectedCheckpointIdx } = useTrainingStore();

  if (checkpoints.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-400">
        <span>Policy at episode</span>
        <span className="font-mono text-indigo-300">
          {checkpoints[selectedCheckpointIdx]?.episode ?? "—"}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={checkpoints.length - 1}
        step={1}
        value={selectedCheckpointIdx >= 0 ? selectedCheckpointIdx : 0}
        onChange={(e) => setSelectedCheckpointIdx(parseInt(e.target.value))}
        className="w-full accent-indigo-500"
      />
      <div className="flex justify-between text-xs text-gray-600">
        <span>ep {checkpoints[0]?.episode}</span>
        <span>ep {checkpoints[checkpoints.length - 1]?.episode}</span>
      </div>
    </div>
  );
}
