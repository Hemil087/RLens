"use client";
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTrainingStore } from "@/store/trainingStore";
import { rollingAverage } from "@/lib/smoothing";

export function RewardCurve() {
  const { episodeHistory, checkpoints, finalStats } = useTrainingStore();
  const [showSmoothed, setShowSmoothed] = useState(true);

  const data = useMemo(() => {
    const rewards = episodeHistory.map((e) => e.reward);
    const smoothed = rollingAverage(rewards, 100);
    return episodeHistory.map((e, i) => ({
      episode: e.episode,
      reward: e.reward,
      rollingAvg: parseFloat(smoothed[i].toFixed(2)),
    }));
  }, [episodeHistory]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-sm gap-2">
        <span className="text-2xl">▶</span>
        Hit Start to begin training
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">Reward per episode</span>
        <button
          onClick={() => setShowSmoothed((s) => !s)}
          className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          {showSmoothed ? "Hide smoothed" : "Show smoothed"}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="episode" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "#111118", border: "1px solid #374151", borderRadius: 8 }}
            labelStyle={{ color: "#e5e7eb" }}
            itemStyle={{ color: "#9ca3af" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Line
            type="monotone"
            dataKey="reward"
            stroke="#6366f1"
            strokeWidth={1.5}
            dot={false}
            opacity={0.6}
            isAnimationActive={false}
            name="Raw reward"
          />
          {showSmoothed && (
            <Line
              type="monotone"
              dataKey="rollingAvg"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              name="Rolling avg (100)"
            />
          )}
          {checkpoints.map((cp) => (
            <ReferenceLine
              key={cp.episode}
              x={cp.episode}
              stroke="#374151"
              strokeDasharray="3 3"
            />
          ))}
          {finalStats?.convergence_episode && (
            <ReferenceLine
              x={finalStats.convergence_episode}
              stroke="#22c55e"
              strokeDasharray="4 2"
              label={{ value: "Converged", fill: "#22c55e", fontSize: 10 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
