"use client";
import { useRef, useCallback } from "react";
import { useCompareStore } from "@/store/compareStore";
import type { AlgorithmType } from "@/types";

export function useCompareSocket(target: "A" | "B") {
  const wsRef = useRef<WebSocket | null>(null);
  const store = useCompareStore();

  const startTraining = useCallback(
    (algorithm: AlgorithmType, params: Record<string, number>) => {
      if (wsRef.current) wsRef.current.close();
      store.clearRunHistory(target);
      store.setStatus(target, "training");

      const ws = new WebSocket("ws://localhost:8000/ws/train");
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start_training", algorithm, params }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        // P1 protocol: episodes arrive in batches. Kept the single-episode
        // branch too for backward-compat during rollout / manual testing.
        if (msg.type === "episode_batch") store.appendEpisodeBatch(target, msg.episodes);
        else if (msg.type === "episode_update") store.appendEpisode(target, msg);
        else if (msg.type === "checkpoint") store.appendCheckpoint(target, msg);
        else if (msg.type === "training_complete") {
          store.setFinalStats(target, msg);
          store.setStatus(target, "complete");
        }
      };

      ws.onerror = () => store.setStatus(target, "error");
      ws.onclose = () => {};
    },
    [store, target]
  );

  const stopTraining = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cancel" }));
    }
    store.setStatus(target, "idle");
  }, [store, target]);

  return { startTraining, stopTraining };
}