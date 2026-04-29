"use client";
import { useState } from "react";
import { useTrainingStore } from "@/store/trainingStore";
import { useReplayStore } from "@/store/replayStore";

export function ReplayControls() {
  const { checkpoints } = useTrainingStore();
  const { fps, setFps, setLoading, setGifData, isLoading } = useReplayStore();
  const [cpIdx, setCpIdx] = useState(0);

  const handleLoad = async () => {
    const cp = checkpoints[cpIdx] ?? checkpoints[checkpoints.length - 1];
    if (!cp) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/replay/gif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy_snapshot: cp.policy_snapshot, fps }),
      });
      const data = await res.json();
      setGifData(data.gif_b64, data.total_steps, data.total_reward);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Checkpoint</label>
        <select
          value={cpIdx}
          onChange={(e) => setCpIdx(parseInt(e.target.value))}
          className="text-sm bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1"
          disabled={checkpoints.length === 0}
        >
          {checkpoints.length === 0
            ? <option>No checkpoints yet</option>
            : checkpoints.map((cp, i) => (
                <option key={i} value={i}>Episode {cp.episode}</option>
              ))
          }
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">FPS</label>
        <select
          value={fps}
          onChange={(e) => setFps(parseInt(e.target.value))}
          className="text-sm bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1"
        >
          {[2, 4, 8].map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <button
        onClick={handleLoad}
        disabled={isLoading || checkpoints.length === 0}
        className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Loading..." : "▶ Load & Play"}
      </button>
    </div>
  );
}
