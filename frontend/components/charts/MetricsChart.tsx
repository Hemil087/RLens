"use client";
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useTrainingStore } from "@/store/trainingStore";

export function MetricsChart() {
  const { episodeHistory, algorithm } = useTrainingStore();
  const isTabular = algorithm === "q_learning" || algorithm === "sarsa";

  const data = useMemo(() => {
    return episodeHistory
      .filter((_, i) => i % 5 === 0)
      .map((e) => ({
        episode: e.episode,
        td_error: e.extra_metrics?.td_error ?? null,
        policy_loss: e.extra_metrics?.policy_loss ?? null,
        value_loss: e.extra_metrics?.value_loss ?? null,
      }));
  }, [episodeHistory]);

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
