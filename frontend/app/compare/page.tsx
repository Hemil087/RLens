"use client";
import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/shared/Card";
import { CompareChart } from "@/components/charts/CompareChart";
import { PolicyArrows } from "@/components/policy/PolicyArrows";
import { StateValueMap } from "@/components/policy/StateValueMap";
import { CheckpointSlider } from "@/components/policy/CheckpointSlider";
import { useCompareStore } from "@/store/compareStore";
import { useCompareSocket } from "@/hooks/useCompareSocket";
import { useAlgorithmMeta } from "@/hooks/useAlgorithmMeta";
import { diffPolicies } from "@/lib/policy-utils";
import type { AlgorithmType } from "@/types";

const ALG_LABELS: Record<AlgorithmType, string> = {
  q_learning: "Q-Learning", sarsa: "SARSA",
  reinforce: "REINFORCE", actor_critic: "Actor-Critic",
};

function RunPanel({ target }: { target: "A" | "B" }) {
  const store = useCompareStore();
  const { startTraining, stopTraining } = useCompareSocket(target);
  const run = target === "A" ? store.runA : store.runB;
  const otherRun = target === "A" ? store.runB : store.runA;
  const algorithms = useAlgorithmMeta();
  const color = target === "A" ? "indigo" : "amber";

  const handleAlgChange = (id: AlgorithmType) => {
    store.setAlgorithm(target, id);
    const meta = algorithms.find((a) => a.id === id);
    if (meta) {
      const p: Record<string, number> = {};
      meta.params.forEach((param) => (p[param.name] = param.default));
      store.setParams(target, p);
    }
  };

  return (
    <div className="flex-1 min-w-0 space-y-3">
      <div className={`text-xs font-bold uppercase tracking-wider text-${color}-400`}>
        Run {target}
      </div>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(ALG_LABELS) as AlgorithmType[]).map((id) => {
          const isSelected = run.algorithm === id;
          const isTaken = otherRun.algorithm === id;
          return (
            <button key={id}
              onClick={() => !isTaken && handleAlgChange(id)}
              disabled={isTaken}
              title={isTaken ? `Already used by Run ${target === "A" ? "B" : "A"}` : undefined}
              className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                isSelected
                  ? target === "A"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-amber-600 border-amber-500 text-white"
                  : isTaken
                  ? "bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed line-through"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
              }`}>
              {ALG_LABELS[id]}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => startTraining(run.algorithm, run.params)}
          disabled={run.status === "training"}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg font-semibold disabled:opacity-40"
        >Start</button>
        {run.status === "training" && (
          <button onClick={stopTraining}
            className="px-3 py-1.5 bg-gray-700 text-white text-xs rounded-lg font-semibold">
            Stop
          </button>
        )}
        <span className="text-xs text-gray-500 self-center font-mono">
          {run.episodeHistory.length.toLocaleString()} eps
        </span>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const { runA, runB } = useCompareStore();
  const [showDiff, setShowDiff] = useState(false);

  const snapshotA = runA.checkpoints[runA.selectedCheckpointIdx]?.policy_snapshot;
  const snapshotB = runB.checkpoints[runB.selectedCheckpointIdx]?.policy_snapshot;
  const diff = showDiff && snapshotA && snapshotB ? diffPolicies(snapshotA, snapshotB) : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Compare" />
      <div className="flex flex-col gap-4 p-4 overflow-auto">
        <Card>
          <div className="flex gap-6 flex-wrap">
            <RunPanel target="A" />
            <div className="w-px bg-gray-800" />
            <RunPanel target="B" />
          </div>
        </Card>

        <Card title="Reward Comparison">
          <CompareChart />
        </Card>

        {(snapshotA || snapshotB) && (
          <Card title="Policy Comparison">
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setShowDiff((d) => !d)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${
                  showDiff ? "bg-red-900 border-red-700 text-red-300" : "bg-gray-800 border-gray-700 text-gray-400"
                }`}
              >
                {showDiff ? "Hide Diff" : "Show Diff"}
              </button>
            </div>
            <div className="flex gap-6 flex-wrap">
              <div>
                <div className="text-xs text-indigo-400 mb-2">Run A — ep {runA.checkpoints[runA.selectedCheckpointIdx]?.episode}</div>
                {snapshotA?.type === "q_table"
                  ? <PolicyArrows snapshot={snapshotA} highlightDiff={diff} />
                  : <StateValueMap snapshot={snapshotA} />}
              </div>
              <div>
                <div className="text-xs text-amber-400 mb-2">Run B — ep {runB.checkpoints[runB.selectedCheckpointIdx]?.episode}</div>
                {snapshotB?.type === "q_table"
                  ? <PolicyArrows snapshot={snapshotB} highlightDiff={diff} />
                  : <StateValueMap snapshot={snapshotB} />}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
