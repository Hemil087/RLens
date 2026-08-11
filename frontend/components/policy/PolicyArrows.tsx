"use client";
import { useState, useMemo, memo } from "react";
import { useTrainingStore } from "@/store/trainingStore";
import {
  DEST_POSITIONS, ACTION_SYMBOLS, LOCATION_COLORS,
  getStatesForCell, getModeAction,
} from "@/lib/policy-utils";
import type { PolicySnapshot } from "@/types";

const CELL = 72;
const LOC_NAMES = ["R", "G", "Y", "B"];

interface Props {
  snapshot?: PolicySnapshot;
  highlightDiff?: boolean[][];
}

// P3-2: precomputed once per (snapshot, filter) change, not once per render.
// Also decouples the render loop from the aggregation math so the JSX below
// is a straight iteration with no per-cell function calls.
interface CellData {
  row: number;
  col: number;
  states: number[];
  action: number;
  uncertainty: number;
  intensity: number;
  locIdx: number;
}

function PolicyArrowsInner({ snapshot, highlightDiff }: Props) {
  const storeSnapshot = useTrainingStore(
    (s) => s.checkpoints[s.selectedCheckpointIdx]?.policy_snapshot
  );
  const active = snapshot ?? storeSnapshot;

  const [passFilter, setPassFilter] = useState<number | null>(null);
  const [destFilter, setDestFilter] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ row: number; col: number } | null>(null);

  // Range for coloring — computed once per snapshot, not per cell per render.
  const qRange = useMemo(() => {
    if (!active || active.type !== "q_table" || !active.q_table) return null;
    let mn = Infinity;
    let mx = -Infinity;
    for (const row of active.q_table) {
      for (const v of row) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    return { min: mn, max: mx };
  }, [active]);

  // The full 5×5 grid's per-cell data. Runs on snapshot / filter change only.
  // Hover state changes do NOT re-run this — they just re-render the JSX
  // which reads pre-computed values.
  const cells = useMemo<CellData[] | null>(() => {
    if (!active) return null;
    const isQTable = active.type === "q_table";
    const range = qRange ? qRange.max - qRange.min : 1;
    const out: CellData[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const states = getStatesForCell(row, col, passFilter, destFilter);
        const { action, uncertainty } = getModeAction(active.greedy_policy, states);

        let intensity = 0.15;
        if (isQTable && active.q_table && qRange && range > 0) {
          let cellMax = -Infinity;
          for (const s of states) {
            for (const v of active.q_table[s]) {
              if (v > cellMax) cellMax = v;
            }
          }
          intensity = (cellMax - qRange.min) / range;
        }

        const locIdx = DEST_POSITIONS.findIndex(([r, c]) => r === row && c === col);
        out.push({ row, col, states, action, uncertainty, intensity, locIdx });
      }
    }
    return out;
  }, [active, passFilter, destFilter, qRange]);

  if (!active || !cells) return (
    <div className="text-gray-600 text-xs text-center py-8">
      Train to see policy visualization
    </div>
  );

  const isQTable = active.type === "q_table";

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="text-xs text-gray-500 mr-1">Passenger</label>
          <select
            value={passFilter ?? "all"}
            onChange={(e) => setPassFilter(e.target.value === "all" ? null : parseInt(e.target.value))}
            className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-1 py-0.5"
          >
            <option value="all">All</option>
            {LOC_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            <option value="4">In taxi</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mr-1">Destination</label>
          <select
            value={destFilter ?? "all"}
            onChange={(e) => setDestFilter(e.target.value === "all" ? null : parseInt(e.target.value))}
            className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-1 py-0.5"
          >
            <option value="all">All</option>
            {LOC_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
        </div>
      </div>

      <svg width={5 * CELL} height={5 * CELL} className="rounded overflow-hidden">
        {cells.map(({ row, col, states, action, uncertainty, intensity, locIdx }) => {
          const isDiff = highlightDiff?.[row]?.[col];
          const bgColor = isDiff
            ? "rgba(239,68,68,0.25)"
            : `rgba(99,102,241,${0.05 + intensity * 0.3})`;
          const isHovered = tooltip?.row === row && tooltip?.col === col;

          return (
            <g key={`${row}-${col}`}
              onMouseEnter={() => setTooltip({ row, col })}
              onMouseLeave={() => setTooltip(null)}
            >
              <rect
                x={col * CELL} y={row * CELL}
                width={CELL} height={CELL}
                fill={bgColor}
                stroke="#1f2937" strokeWidth={1}
              />
              {locIdx >= 0 && (
                <rect
                  x={col * CELL + 2} y={row * CELL + 2}
                  width={CELL - 4} height={CELL - 4}
                  fill="none"
                  stroke={LOCATION_COLORS[locIdx]}
                  strokeWidth={2} rx={3}
                />
              )}
              <text
                x={col * CELL + CELL / 2}
                y={row * CELL + CELL / 2 + 6}
                textAnchor="middle"
                fontSize={22}
                fill={uncertainty > 0.5 ? "#6b7280" : "#e5e7eb"}
              >
                {ACTION_SYMBOLS[action]}
              </text>
              {locIdx >= 0 && (
                <text
                  x={col * CELL + 8} y={row * CELL + 14}
                  fontSize={10} fill={LOCATION_COLORS[locIdx]} fontWeight="bold"
                >
                  {LOC_NAMES[locIdx]}
                </text>
              )}
              {isHovered && isQTable && active.q_table && states.length > 0 && (
                <g>
                  <rect x={col * CELL} y={row * CELL + CELL - 18}
                    width={CELL} height={18} fill="rgba(17,17,24,0.92)" rx={0} />
                  <text
                    x={col * CELL + CELL / 2} y={row * CELL + CELL - 5}
                    textAnchor="middle" fontSize={7} fill="#9ca3af"
                  >
                    {["S","N","E","W","Pu","Do"].map((n, i) =>
                      `${n}:${active.q_table![states[0]]?.[i]?.toFixed(1) ?? "-"}`
                    ).join(" ")}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// P3-2: React.memo lets the compare page skip re-renders when parent
// re-renders but neither `snapshot` (referentially stable per checkpoint)
// nor `highlightDiff` (memoized in the compare page) has changed.
export const PolicyArrows = memo(PolicyArrowsInner);