import type { ChartPoint } from "@/types";

// P2 downsampling: cap the number of points sent to Recharts so long runs
// (e.g. 9000-episode REINFORCE) don't hand SVG a path with thousands of
// segments per re-render. Simple stride sampling — preserves overall shape
// and general noise level, may miss individual extreme spikes.
//
// The rolling-average line is smooth by construction so it strides cleanly.
// If a project ever needs peak-preserving downsampling for the raw line,
// swap this for min/max bucketing or LTTB.
export function stride<T>(data: T[], targetLen: number): T[] {
  if (data.length <= targetLen) return data;
  const step = Math.ceil(data.length / targetLen);
  const out: T[] = [];
  for (let i = 0; i < data.length; i += step) out.push(data[i]);
  // Always keep the last point so the tail of the chart doesn't get chopped.
  if (out[out.length - 1] !== data[data.length - 1]) out.push(data[data.length - 1]);
  return out;
}

// Cap used across charts. 800 points is well below the size where Recharts
// starts to feel sluggish, and well above the resolution the eye can
// distinguish on a ~1200px-wide chart.
export const MAX_DISPLAY_POINTS = 800;

export function displaySeries(data: ChartPoint[]): ChartPoint[] {
  return stride(data, MAX_DISPLAY_POINTS);
}