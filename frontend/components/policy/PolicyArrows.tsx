"use client";
import { useState, useMemo } from "react";
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

export function PolicyArrows({ snapshot, highlightDiff }: Props) {
  // P2: narrow selector — read only the currently-selected snapshot, not the
  // whole store. When the parent passes `snapshot` explicitly (compare page),
  // we use that; otherwise fall back to the store-selected checkpoint.
  const storeSnapshot = useTrainingStore(
    (s) => s.checkpoints[s.selectedCheckpointIdx]?.policy_snapshot
  );
  const active = snapshot ?? storeSnapshot;

  const [passFilter, setPassFilter] = useState<number | null>(null);
  const [destFilter, setDestFilter] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ row: number; col: number } | null>(null);

  // P2: compute q-table min/max ONCE per snapshot, not once per cell per
  // render. Was previously computing `Math.min(...q.flat())` twice per cell
  // (50 cells) inside getMaxQ — 100 spread calls of ~3000 args, every render.
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

  if (!active) return (
    <div className="text-gray-600 text-xs text-center py-8">
      Train to see policy visualization
    </div>
  );

  const isQTable = active.type === "q_table";

  const getMaxQ = (states: number[]) => {
    if (!isQTable || !active.q_table || !qRange) return 0;
    let cellMax = -Infinity;
    for (const s of states) {
      for (const v of active.q_table[s]) {
        if (v > cellMax) cellMax = v;
      }
    }
    const range = qRange.max - qRange.min;
    return range === 0 ? 0 : (cellMax - qRange.min) / range;
  };

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
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const states = getStatesForCell(row, col, passFilter, destFilter);
            const { action, uncertainty } = getModeAction(active.greedy_policy, states);
            const intensity = isQTable ? getMaxQ(states) : 0.15;
            const isDiff = highlightDiff?.[row]?.[col];

            const locIdx = DEST_POSITIONS.findIndex(([r, c]) => r === row && c === col);
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
          })
        )}
      </svg>
    </div>
  );
}