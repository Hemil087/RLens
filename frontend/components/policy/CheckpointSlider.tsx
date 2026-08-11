"use client";
import { useTrainingStore } from "@/store/trainingStore";

export function CheckpointSlider() {
  // P3 (P2 followup): narrow selectors. Previously destructured the whole
  // store, so this slider re-rendered on every episode batch even though its
  // content only depends on checkpoints + selectedCheckpointIdx.
  const checkpoints = useTrainingStore((s) => s.checkpoints);
  const selectedCheckpointIdx = useTrainingStore((s) => s.selectedCheckpointIdx);
  const setSelectedCheckpointIdx = useTrainingStore(
    (s) => s.setSelectedCheckpointIdx
  );

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