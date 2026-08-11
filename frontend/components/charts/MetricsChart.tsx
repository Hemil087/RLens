"use client";
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useTrainingStore } from "@/store/trainingStore";
import { displaySeries } from "@/lib/chart-utils";

export function MetricsChart() {
  // P2: narrow selectors — this component re-renders only when chart data
  // grows or when the user swaps algorithm. It ignores checkpoints,
  // policy-viz interactions, and connection state.
  const chartData = useTrainingStore((s) => s.chartData);
  const algorithm = useTrainingStore((s) => s.algorithm);
  const isTabular = algorithm === "q_learning" || algorithm === "sarsa";

  // ChartPoint already has td_error / policy_loss / value_loss on it. Recharts
  // just picks the ones we ask for via dataKey. Downsample identically to the
  // reward curve so the two charts stay visually aligned on the x-axis.
  const data = useMemo(() => displaySeries(chartData), [chartData]);

  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-xs gap-1">
      <span className="text-xl">📊</span>
      Metrics will appear here during training
    </div>
  );

  return (
    <div>
      <span className="text-xs text-gray-400">
        {isTabular ? "TD Error" : "Policy & Value Loss"}
      </span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="episode" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "#111118", border: "1px solid #374151", borderRadius: 8 }}
            labelStyle={{ color: "#e5e7eb" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          {isTabular ? (
            <Line type="monotone" dataKey="td_error" stroke="#6366f1" strokeWidth={1.5}
              dot={false} isAnimationActive={false} name="TD Error" />
          ) : (
            <>
              <Line type="monotone" dataKey="policy_loss" stroke="#f59e0b" strokeWidth={1.5}
                dot={false} isAnimationActive={false} name="Policy Loss" />
              <Line type="monotone" dataKey="value_loss" stroke="#22c55e" strokeWidth={1.5}
                dot={false} isAnimationActive={false} name="Value Loss" />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}