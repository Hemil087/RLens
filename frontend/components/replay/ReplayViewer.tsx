"use client";
import { useReplayStore } from "@/store/replayStore";
import { Spinner } from "@/components/shared/Spinner";

export function ReplayViewer() {
  const { gifData, isLoading } = useReplayStore();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="w-full max-w-md mx-auto h-64 bg-gray-800 rounded-lg animate-pulse" />
        <div className="flex justify-center">
          <Spinner label="Generating episode..." />
        </div>
      </div>
    );
  }

  if (!gifData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-sm gap-2">
        <span className="text-3xl">▶</span>
        Select a checkpoint and hit Load & Play
      </div>
    );
  }

  return (
    <img
      src={`data:image/gif;base64,${gifData}`}
      alt="Episode replay"
      className="rounded-lg border border-gray-700 w-full max-w-md mx-auto block"
    />
  );
}
