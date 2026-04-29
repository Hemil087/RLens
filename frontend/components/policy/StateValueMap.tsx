"use client";
import { useTrainingStore } from "@/store/trainingStore";
import { DEST_POSITIONS, LOCATION_COLORS, ACTION_SYMBOLS, getStatesForCell, getModeAction, getAvgValue } from "@/lib/policy-utils";
import type { PolicySnapshot } from "@/types";

const CELL = 72;
const LOC_NAMES = ["R", "G", "Y", "B"];

function valueToColor(normalized: number) {
  const r = Math.round(30 + normalized * 180);
  const g = Math.round(60 + normalized * 140);
  const b = Math.round(180 - normalized * 120);
  return `rgb(${r},${g},${b})`;
}

interface Props { snapshot?: PolicySnapshot }

export function StateValueMap({ snapshot }: Props) {
  const store = useTrainingStore();
  const active = snapshot ?? store.checkpoints[store.selectedCheckpointIdx]?.policy_snapshot;

  if (!active || (active.type !== "policy_network" && active.type !== "tabular_policy") || !active.state_values) return null;

  const allValues = active.state_values;
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;

  return (
    <svg width={5 * CELL} height={5 * CELL} className="rounded overflow-hidden">
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const states = getStatesForCell(row, col, null, null);
          const avgV = getAvgValue(allValues, states);
          const normalized = (avgV - minV) / range;
          const { action } = getModeAction(active.greedy_policy, states);
          const locIdx = DEST_POSITIONS.findIndex(([r, c]) => r === row && c === col);

          return (
            <g key={`${row}-${col}`}>
              <rect
                x={col * CELL} y={row * CELL}
                width={CELL} height={CELL}
                fill={valueToColor(normalized)}
                stroke="#1f2937" strokeWidth={1}
              />
              {locIdx >= 0 && (
                <rect x={col * CELL + 2} y={row * CELL + 2}
                  width={CELL - 4} height={CELL - 4}
                  fill="none" stroke={LOCATION_COLORS[locIdx]} strokeWidth={2} rx={3}
                />
              )}
              <text
                x={col * CELL + CELL / 2} y={row * CELL + CELL / 2 + 6}
                textAnchor="middle" fontSize={22} fill="rgba(255,255,255,0.85)"
              >
                {ACTION_SYMBOLS[action]}
              </text>
              {locIdx >= 0 && (
                <text x={col * CELL + 8} y={row * CELL + 14}
                  fontSize={10} fill={LOCATION_COLORS[locIdx]} fontWeight="bold"
                >
                  {LOC_NAMES[locIdx]}
                </text>
              )}
              <text
                x={col * CELL + CELL / 2} y={row * CELL + CELL - 6}
                textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.6)"
              >
                {avgV.toFixed(1)}
              </text>
            </g>
          );
        })
      )}
    </svg>
  );
}
