"use client";
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTrainingStore } from "@/store/trainingStore";
import { stride, MAX_DISPLAY_POINTS } from "@/lib/chart-utils";

export function EpsilonDecayChart() {
  // P3 (P2 followup): narrow selectors + read pre-shaped chartData instead
  // of raw episodeHistory. Same treatment as RewardCurve / MetricsChart.
  const chartData = useTrainingStore((s) => s.chartData);
  const algorithm = useTrainingStore((s) => s.algorithm);
  const isTabular = algorithm === "q_learning" || algorithm === "sarsa";

  const data = useMemo(() => {
    if (!isTabular) return [];
    // Only tabular methods emit epsilon. Filter out undefined then downsample.
    const filtered = chartData.filter((p) => p.epsilon !== undefined);
    return stride(filtered, MAX_DISPLAY_POINTS);
  }, [chartData, isTabular]);

  if (!isTabular || data.length === 0) return null;

  return (
    <div>
      <span className="text-xs text-gray-400">Epsilon Decay</span>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="episode" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis domain={[0, 1]} tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "#111118", border: "1px solid #374151", borderRadius: 8 }}
            labelStyle={{ color: "#e5e7eb" }}
          />
          <Line type="monotone" dataKey="epsilon" stroke="#a78bfa" strokeWidth={2}
            dot={false} isAnimationActive={false} name="Epsilon" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}