export const DEST_POSITIONS: [number, number][] = [
  [0, 0], // R
  [0, 4], // G
  [4, 0], // Y
  [4, 3], // B
];

export const ACTION_SYMBOLS: Record<number, string> = {
  0: "↓", 1: "↑", 2: "→", 3: "←", 4: "P", 5: "D",
};

export const LOCATION_COLORS: Record<number, string> = {
  0: "#ef4444", 1: "#22c55e", 2: "#eab308", 3: "#3b82f6",
};

export function decodeState(s: number) {
  const destIdx = s % 4;
  const passLoc = Math.floor(s / 4) % 5;
  const taxiCol = Math.floor(s / 20) % 5;
  const taxiRow = Math.floor(s / 100);
  return { taxiRow, taxiCol, passLoc, destIdx };
}

export function getStatesForCell(
  row: number, col: number,
  passFilter: number | null, destFilter: number | null
): number[] {
  const states: number[] = [];
  for (let passLoc = 0; passLoc < 5; passLoc++) {
    if (passFilter !== null && passLoc !== passFilter) continue;
    for (let destIdx = 0; destIdx < 4; destIdx++) {
      if (destFilter !== null && destIdx !== destFilter) continue;
      states.push((row * 5 + col) * 20 + passLoc * 4 + destIdx);
    }
  }
  return states;
}

export function getModeAction(greedy_policy: number[], states: number[]) {
  if (states.length === 0) return { action: 0, uncertainty: 0 };
  const counts = new Array(6).fill(0);
  states.forEach((s) => counts[greedy_policy[s]]++);
  const maxCount = Math.max(...counts);
  return { action: counts.indexOf(maxCount), uncertainty: 1 - maxCount / states.length };
}

export function getAvgValue(state_values: number[], states: number[]) {
  if (!state_values || states.length === 0) return 0;
  return states.reduce((sum, s) => sum + state_values[s], 0) / states.length;
}

export function diffPolicies(snapshotA: { greedy_policy: number[] }, snapshotB: { greedy_policy: number[] }) {
  const diff: boolean[][] = Array.from({ length: 5 }, () => new Array(5).fill(false));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const states = getStatesForCell(r, c, null, null);
      const a = getModeAction(snapshotA.greedy_policy, states).action;
      const b = getModeAction(snapshotB.greedy_policy, states).action;
      diff[r][c] = a !== b;
    }
  }
  return diff;
}
