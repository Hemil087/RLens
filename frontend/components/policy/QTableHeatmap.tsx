"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTrainingStore } from "@/store/trainingStore";

const ACTION_NAMES = ["South", "North", "East", "West", "Pickup", "Dropoff"];
const CELL_H = 2;
const CELL_W = 40;
const N_STATES = 500;

function qToColor(norm: number): string {
  const h = 240 - norm * 180;
  return `hsl(${h},70%,45%)`;
}

export function QTableHeatmap() {
  const snapshot = useTrainingStore(
    (s) => s.checkpoints[s.selectedCheckpointIdx]?.policy_snapshot
  );

  const [selectedAction, setSelectedAction] = useState<number | null>(null);
  const [hoverState, setHoverState] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { min, max } = useMemo(() => {
    if (!snapshot || snapshot.type !== "q_table" || !snapshot.q_table) {
      return { min: 0, max: 1 };
    }
    let mn = Infinity;
    let mx = -Infinity;
    for (const row of snapshot.q_table) {
      for (const v of row) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    return { min: mn, max: mx };
  }, [snapshot]);

  const actions = useMemo(
    () => (selectedAction !== null ? [selectedAction] : [0, 1, 2, 3, 4, 5]),
    [selectedAction]
  );

  // P3-1: canvas render. One fillRect loop instead of 3000 React-managed
  // <rect> elements. Interaction (toggling action columns) becomes a single
  // canvas repaint instead of a 3000-node React reconciliation pass.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!snapshot || snapshot.type !== "q_table" || !snapshot.q_table) return;

    const q = snapshot.q_table;
    const width = actions.length * CELL_W;
    const height = N_STATES * CELL_H;

    // devicePixelRatio scaling so the fills stay crisp on retina displays.
    // Cheap — the canvas is 240×1000 logical pixels at most.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const range = max - min || 1;
    for (let stateIdx = 0; stateIdx < N_STATES; stateIdx++) {
      const row = q[stateIdx];
      for (let colIdx = 0; colIdx < actions.length; colIdx++) {
        const norm = (row[actions[colIdx]] - min) / range;
        ctx.fillStyle = qToColor(norm);
        ctx.fillRect(colIdx * CELL_W, stateIdx * CELL_H, CELL_W, CELL_H);
      }
    }
  }, [snapshot, actions, min, max]);

  if (!snapshot || snapshot.type !== "q_table" || !snapshot.q_table) return null;
  const q = snapshot.q_table;

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const stateIdx = Math.floor(y / CELL_H);
    setHoverState(stateIdx >= 0 && stateIdx < N_STATES ? stateIdx : null);
  };

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

      {/* Hover readout — replaces the pre-P3 lack of any per-state info.
          Fixed-height so the layout doesn't jump when the cursor enters/leaves. */}
      <div className="text-[10px] font-mono text-gray-400 h-4">
        {hoverState !== null ? (
          <>
            <span className="text-gray-500">state {hoverState}:</span>{" "}
            {ACTION_NAMES.map((n, i) => (
              <span key={i} className="mr-2">
                <span className="text-gray-600">{n[0]}</span>{q[hoverState][i].toFixed(1)}
              </span>
            ))}
          </>
        ) : (
          <span className="text-gray-600">hover a row to inspect state Q-values</span>
        )}
      </div>

      <div className="overflow-auto max-h-64">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverState(null)}
          className="cursor-crosshair"
        />
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