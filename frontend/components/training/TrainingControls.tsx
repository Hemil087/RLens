"use client";
import { useTrainingStore } from "@/store/trainingStore";
import { useTrainingSocket } from "@/hooks/useTrainingSocket";

export function TrainingControls() {
  const { status, algorithm, params, episodeHistory } = useTrainingStore();
  const { startTraining, stopTraining } = useTrainingSocket();

  const n_episodes = params.n_episodes ?? 3000;
  const current = episodeHistory.length;
  const progress = Math.min((current / n_episodes) * 100, 100);
  const isTraining = status === "training";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => startTraining(algorithm, params)}
          disabled={isTraining}
          className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
        >
          Start
        </button>
        {isTraining && (
          <button
            onClick={stopTraining}
            className="flex-1 py-2 rounded-lg bg-gray-700 text-white text-sm font-semibold hover:bg-gray-600 transition-colors"
          >
            Stop
          </button>
        )}
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Episode progress</span>
          <span className="font-mono">
            {current.toLocaleString()} / {n_episodes.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
