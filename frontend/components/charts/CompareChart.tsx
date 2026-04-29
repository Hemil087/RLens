"use client";
import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useCompareStore } from "@/store/compareStore";
import { rollingAverage } from "@/lib/smoothing";

export function CompareChart() {
  const { runA, runB, activeMetric, setActiveMetric } = useCompareStore();
  const [smoothed, setSmoothed] = useState(true);

  const data = useMemo(() => {
    const maxLen = Math.max(runA.episodeHistory.length, runB.episodeHistory.length);
    if (maxLen === 0) return [];

    const aRewards = runA.episodeHistory.map((e) => e.reward);
    const bRewards = runB.episodeHistory.map((e) => e.reward);
    const aSm = rollingAverage(aRewards, 100);
    const bSm = rollingAverage(bRewards, 100);

    return Array.from({ length: maxLen }, (_, i) => ({
      episode: (runA.episodeHistory[i] ?? runB.episodeHistory[i])?.episode ?? i + 1,
      a_reward: smoothed ? (aSm[i] ?? null) : (aRewards[i] ?? null),
      b_reward: smoothed ? (bSm[i] ?? null) : (bRewards[i] ?? null),
      a_td: runA.episodeHistory[i]?.extra_metrics?.td_error ?? null,
      b_td: runB.episodeHistory[i]?.extra_metrics?.td_error ?? null,
    }));
  }, [runA.episodeHistory, runB.episodeHistory, smoothed]);

  const isEmpty = runA.episodeHistory.length === 0 && runB.episodeHistory.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Start both runs to compare
      </div>
    );
  }

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
          {activeMetric === "reward" ? (
            <>
              <Line type="monotone" dataKey="a_reward" stroke="#6366f1" strokeWidth={2}
                dot={false} isAnimationActive={false} name={`Run A (${runA.algorithm})`} connectNulls />
              <Line type="monotone" dataKey="b_reward" stroke="#f59e0b" strokeWidth={2}
                dot={false} isAnimationActive={false} name={`Run B (${runB.algorithm})`} connectNulls />
            </>
          ) : (
            <>
              <Line type="monotone" dataKey="a_td" stroke="#6366f1" strokeWidth={2}
                dot={false} isAnimationActive={false} name={`Run A TD`} connectNulls />
              <Line type="monotone" dataKey="b_td" stroke="#f59e0b" strokeWidth={2}
                dot={false} isAnimationActive={false} name={`Run B TD`} connectNulls />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
