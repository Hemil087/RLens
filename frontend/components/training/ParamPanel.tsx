"use client";
import { useTrainingStore } from "@/store/trainingStore";
import { useAlgorithmMeta } from "@/hooks/useAlgorithmMeta";
import { Tooltip } from "@/components/shared/Tooltip";

const PARAM_TOOLTIPS: Record<string, string> = {
  alpha: "Learning rate — how much to update Q-values each step. Too high = unstable, too low = slow convergence.",
  gamma: "Discount factor — how much to value future rewards vs immediate ones. 0.99 = care a lot about the future.",
  epsilon_end: "Final exploration rate after decay. Small value means agent mostly exploits learned policy at end.",
  n_episodes: "Total number of training episodes. More episodes = better convergence but slower.",
  checkpoint_every: "Save a policy snapshot every N episodes for scrubbing the checkpoint slider.",
  alpha_theta: "Policy network learning rate — controls how fast the actor updates.",
  alpha_w: "Value network learning rate — controls how fast the critic (baseline) updates.",
};

export function ParamPanel() {
  const { algorithm, params, setParam, setParams } = useTrainingStore();
  const algorithms = useAlgorithmMeta();
  const meta = algorithms.find((a) => a.id === algorithm);

  if (!meta) return <div className="text-gray-500 text-sm">Loading params...</div>;

  const setPreset = (preset: "research" | "fast") => {
    const newParams: Record<string, number> = {};
    meta.params.forEach((p) => {
      if (preset === "fast") {
        if (p.name === "n_episodes") newParams[p.name] = 500;
        else if (p.name === "checkpoint_every") newParams[p.name] = 50;
        else newParams[p.name] = p.default;
      } else {
        newParams[p.name] = p.default;
      }
    });
    setParams(newParams);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setPreset("research")}
          className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700">
          Research defaults
        </button>
        <button onClick={() => setPreset("fast")}
          className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700">
          Fast training
        </button>
      </div>
      {meta.params.map((p) => (
        <div key={p.name}>
          <div className="flex justify-between mb-1">
            <Tooltip text={PARAM_TOOLTIPS[p.name] ?? p.label}>
              <label className="text-xs text-gray-400 cursor-help border-b border-dotted border-gray-600">
                {p.label}
              </label>
            </Tooltip>
            <span className="text-xs text-gray-200 font-mono">{params[p.name] ?? p.default}</span>
          </div>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step}
            value={params[p.name] ?? p.default}
            onChange={(e) => setParam(p.name, parseFloat(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>
      ))}
    </div>
  );
}
