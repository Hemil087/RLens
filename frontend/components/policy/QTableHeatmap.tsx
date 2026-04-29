"use client";
import { useState, useMemo } from "react";
import { useTrainingStore } from "@/store/trainingStore";

const ACTION_NAMES = ["South", "North", "East", "West", "Pickup", "Dropoff"];
const CELL_H = 2;
const CELL_W = 40;

function qToColor(norm: number) {
  const h = 240 - norm * 180;
  return `hsl(${h},70%,45%)`;
}

export function QTableHeatmap() {
  const store = useTrainingStore();
  const [selectedAction, setSelectedAction] = useState<number | null>(null);

  const snapshot = store.checkpoints[store.selectedCheckpointIdx]?.policy_snapshot;
  if (!snapshot || snapshot.type !== "q_table" || !snapshot.q_table) return null;

  const q = snapshot.q_table;

  const { min, max } = useMemo(() => {
    const flat = q.flat();
    return { min: Math.min(...flat), max: Math.max(...flat) };
  }, [q]);

  const range = max - min || 1;
  const actions = selectedAction !== null ? [selectedAction] : [0, 1, 2, 3, 4, 5];

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {ACTION_NAMES.map((name, i) => (
          <button
            key={i}
            onClick={() => setSelectedAction(selectedAction === i ? null : i)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              selectedAction === i
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="overflow-auto max-h-64">
        <svg
          width={actions.length * CELL_W}
          height={500 * CELL_H}
        >
          {q.map((row, stateIdx) =>
            actions.map((actionIdx, colIdx) => {
              const norm = (row[actionIdx] - min) / range;
              return (
                <rect
                  key={`${stateIdx}-${actionIdx}`}
                  x={colIdx * CELL_W}
                  y={stateIdx * CELL_H}
                  width={CELL_W}
                  height={CELL_H}
                  fill={qToColor(norm)}
                />
              );
            })
          )}
        </svg>
      </div>
      <div className="flex text-xs text-gray-500">
        {actions.map((i) => (
          <div key={i} style={{ width: CELL_W }} className="text-center truncate">
            {ACTION_NAMES[i]}
          </div>
        ))}
      </div>
    </div>
  );
}
