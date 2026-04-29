"use client";
import { clsx } from "clsx";
import { useTrainingStore } from "@/store/trainingStore";
import { useAlgorithmMeta } from "@/hooks/useAlgorithmMeta";
import type { AlgorithmType } from "@/types";

export function AlgorithmSelector() {
  const { algorithm, setAlgorithm, setParams } = useTrainingStore();
  const algorithms = useAlgorithmMeta();

  const handleSelect = (id: AlgorithmType) => {
    setAlgorithm(id);
    const meta = algorithms.find((a) => a.id === id);
    if (meta) {
      const defaults: Record<string, number> = {};
      meta.params.forEach((p) => (defaults[p.name] = p.default));
      setParams(defaults);
    }
  };

  const labels: Record<AlgorithmType, string> = {
    q_learning: "Q-Learning",
    sarsa: "SARSA",
    reinforce: "REINFORCE",
    actor_critic: "Actor-Critic",
  };

  const selectedMeta = algorithms.find((a) => a.id === algorithm);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as AlgorithmType[]).map((id) => (
          <button
            key={id}
            onClick={() => handleSelect(id)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
              algorithm === id
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500"
            )}
          >
            {labels[id]}
          </button>
        ))}
      </div>
      {selectedMeta && (
        <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-800 pt-2">
          {selectedMeta.description}
        </p>
      )}
    </div>
  );
}
