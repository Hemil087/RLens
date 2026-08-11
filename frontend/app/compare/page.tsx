"use client";
import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/shared/Card";
import { CompareChart } from "@/components/charts/CompareChart";
import { PolicyArrows } from "@/components/policy/PolicyArrows";
import { StateValueMap } from "@/components/policy/StateValueMap";
import { useCompareStore } from "@/store/compareStore";
import { useCompareSocket } from "@/hooks/useCompareSocket";
import { useAlgorithmMeta } from "@/hooks/useAlgorithmMeta";
import { diffPolicies } from "@/lib/policy-utils";
import type { AlgorithmType } from "@/types";

const ALG_LABELS: Record<AlgorithmType, string> = {
  q_learning: "Q-Learning", sarsa: "SARSA",
  reinforce: "REINFORCE", actor_critic: "Actor-Critic",
};

// P3 (P2 followup): tiny narrow-selector component that reads only the live
// episode counter. Isolating it here means the surrounding RunPanel (config +
// algorithm buttons) doesn't re-render on every batch — only this ~2-line
// text node does.
function EpisodeCounter({ target }: { target: "A" | "B" }) {
  const count = useCompareStore((s) =>
    target === "A" ? s.runA.episodeHistory.length : s.runB.episodeHistory.length
  );
  return (
    <span className="text-xs text-gray-500 self-center font-mono">
      {count.toLocaleString()} eps
    </span>
  );
}

function RunPanel({ target }: { target: "A" | "B" }) {
  // P3 (P2 followup): read only the run-scoped config + status via narrow
  // selectors. Episode-history growth doesn't wake this component up anymore;
  // the counter above lives in its own subscriber component.
  const algorithm = useCompareStore((s) =>
    target === "A" ? s.runA.algorithm : s.runB.algorithm
  );
  const otherAlgorithm = useCompareStore((s) =>
    target === "A" ? s.runB.algorithm : s.runA.algorithm
  );
  const params = useCompareStore((s) =>
    target === "A" ? s.runA.params : s.runB.params
  );
  const status = useCompareStore((s) =>
    target === "A" ? s.runA.status : s.runB.status
  );
  const setAlgorithm = useCompareStore((s) => s.setAlgorithm);
  const setParams = useCompareStore((s) => s.setParams);

  const { startTraining, stopTraining } = useCompareSocket(target);
  const algorithms = useAlgorithmMeta();
  const color = target === "A" ? "indigo" : "amber";

  const handleAlgChange = (id: AlgorithmType) => {
    setAlgorithm(target, id);
    const meta = algorithms.find((a: { id: AlgorithmType }) => a.id === id);
    if (meta) {
      const p: Record<string, number> = {};
      meta.params.forEach((param: { name: string; default: number }) => (p[param.name] = param.default));
      setParams(target, p);
    }
  };

  return (
    <div className="flex-1 min-w-0 space-y-3">
      <div className={`text-xs font-bold uppercase tracking-wider text-${color}-400`}>
        Run {target}
      </div>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(ALG_LABELS) as AlgorithmType[]).map((id) => {
          const isSelected = algorithm === id;
          const isTaken = otherAlgorithm === id;
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
          onClick={() => startTraining(algorithm, params)}
          disabled={status === "training"}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg font-semibold disabled:opacity-40"
        >Start</button>
        {status === "training" && (
          <button onClick={stopTraining}
            className="px-3 py-1.5 bg-gray-700 text-white text-xs rounded-lg font-semibold">
            Stop
          </button>
        )}
        <EpisodeCounter target={target} />
      </div>
    </div>
  );
}

// P3 (P2 followup): policy-comparison card extracted so its subscription
// scope is decoupled from the top-level ComparePage. Reads only the fields
// it renders — new episode batches to either run cannot wake this card up
// unless a new checkpoint arrives. The `diff` computation is memoized so
// it doesn't rerun when nothing relevant has changed.
function PolicyComparisonCard() {
  const snapshotA = useCompareStore(
    (s) => s.runA.checkpoints[s.runA.selectedCheckpointIdx]?.policy_snapshot
  );
  const snapshotB = useCompareStore(
    (s) => s.runB.checkpoints[s.runB.selectedCheckpointIdx]?.policy_snapshot
  );
  const episodeA = useCompareStore(
    (s) => s.runA.checkpoints[s.runA.selectedCheckpointIdx]?.episode
  );
  const episodeB = useCompareStore(
    (s) => s.runB.checkpoints[s.runB.selectedCheckpointIdx]?.episode
  );

  const [showDiff, setShowDiff] = useState(false);

  const diff = useMemo(
    () =>
      showDiff && snapshotA && snapshotB
        ? diffPolicies(snapshotA, snapshotB)
        : undefined,
    [showDiff, snapshotA, snapshotB]
  );

  if (!snapshotA && !snapshotB) return null;

  return (
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
          <div className="text-xs text-indigo-400 mb-2">Run A — ep {episodeA}</div>
          {snapshotA?.type === "q_table"
            ? <PolicyArrows snapshot={snapshotA} highlightDiff={diff} />
            : <StateValueMap snapshot={snapshotA} />}
        </div>
        <div>
          <div className="text-xs text-amber-400 mb-2">Run B — ep {episodeB}</div>
          {snapshotB?.type === "q_table"
            ? <PolicyArrows snapshot={snapshotB} highlightDiff={diff} />
            : <StateValueMap snapshot={snapshotB} />}
        </div>
      </div>
    </Card>
  );
}

export default function ComparePage() {
  // P3 (P2 followup): no store subscription at the top level — each child
  // component subscribes to just what it needs. This page component now
  // renders exactly once per navigation.
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

        <PolicyComparisonCard />
      </div>
    </div>
  );
}