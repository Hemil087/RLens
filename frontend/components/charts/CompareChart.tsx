"use client";
import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useCompareStore } from "@/store/compareStore";
import { stride, MAX_DISPLAY_POINTS } from "@/lib/chart-utils";

// Merged row for the compare chart. We build one array with fields for both
// runs so a single <LineChart> can render both series on shared axes.
interface CompareRow {
  episode: number;
  a_reward?: number;
  b_reward?: number;
  a_rollingAvg?: number;
  b_rollingAvg?: number;
  a_td?: number;
  b_td?: number;
}

export function CompareChart() {
  // P2: narrow selectors. The chart used to subscribe to the whole store
  // (both runs, activeMetric, everything) and rebuild via .map()+rollingAverage
  // on every batch — twice, once per run. Now we read only what we need and
  // do zero smoothing on the client (backend already sends rolling avg).
  const runAChart = useCompareStore((s) => s.runA.chartData);
  const runBChart = useCompareStore((s) => s.runB.chartData);
  const runAAlgo = useCompareStore((s) => s.runA.algorithm);
  const runBAlgo = useCompareStore((s) => s.runB.algorithm);
  const activeMetric = useCompareStore((s) => s.activeMetric);
  const setActiveMetric = useCompareStore((s) => s.setActiveMetric);

  const [smoothed, setSmoothed] = useState(true);

  const data = useMemo<CompareRow[]>(() => {
    const maxLen = Math.max(runAChart.length, runBChart.length);
    if (maxLen === 0) return [];

    const merged: CompareRow[] = new Array(maxLen);
    for (let i = 0; i < maxLen; i++) {
      const a = runAChart[i];
      const b = runBChart[i];
      merged[i] = {
        episode: (a ?? b)?.episode ?? i + 1,
        a_reward: a?.reward,
        b_reward: b?.reward,
        a_rollingAvg: a?.rollingAvg,
        b_rollingAvg: b?.rollingAvg,
        a_td: a?.td_error,
        b_td: b?.td_error,
      };
    }
    return stride(merged, MAX_DISPLAY_POINTS);
  }, [runAChart, runBChart]);

  const isEmpty = runAChart.length === 0 && runBChart.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Start both runs to compare
      </div>
    );
  }

  // Which fields to plot depends on both `activeMetric` and `smoothed`.
  const aKey = activeMetric === "reward"
    ? (smoothed ? "a_rollingAvg" : "a_reward")
    : "a_td";
  const bKey = activeMetric === "reward"
    ? (smoothed ? "b_rollingAvg" : "b_reward")
    : "b_td";

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        {(["reward", "td_error"] as const).map((m) => (
          <button key={m} onClick={() => setActiveMetric(m)}
            className={`text-xs px-2 py-0.5 rounded ${activeMetric === m ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400"}`}>
            {m === "reward" ? "Reward" : "TD Error"}
          </button>
        ))}
        <button onClick={() => setSmoothed((s) => !s)}
          className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 ml-auto">
          {smoothed ? "Raw" : "Smoothed"}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="episode" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#111118", border: "1px solid #374151", borderRadius: 8 }}
            labelStyle={{ color: "#e5e7eb" }} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Line type="monotone" dataKey={aKey} stroke="#6366f1" strokeWidth={2}
            dot={false} isAnimationActive={false}
            name={activeMetric === "reward" ? `Run A (${runAAlgo})` : "Run A TD"}
            connectNulls />
          <Line type="monotone" dataKey={bKey} stroke="#f59e0b" strokeWidth={2}
            dot={false} isAnimationActive={false}
            name={activeMetric === "reward" ? `Run B (${runBAlgo})` : "Run B TD"}
            connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}