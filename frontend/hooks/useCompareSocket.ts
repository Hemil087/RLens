"use client";
import { useRef, useCallback } from "react";
import { useCompareStore } from "@/store/compareStore";
import type { AlgorithmType } from "@/types";

// P2: no store subscription — read via `getState()` inside handlers so
// `startTraining` / `stopTraining` don't churn on every state change.
export function useCompareSocket(target: "A" | "B") {
  const wsRef = useRef<WebSocket | null>(null);

  const startTraining = useCallback(
    (algorithm: AlgorithmType, params: Record<string, number>) => {
      if (wsRef.current) wsRef.current.close();

      const s = useCompareStore.getState();
      s.clearRunHistory(target);
      s.setStatus(target, "training");

      const ws = new WebSocket("ws://localhost:8000/ws/train");
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start_training", algorithm, params }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const store = useCompareStore.getState();
        if (msg.type === "episode_batch") store.appendEpisodeBatch(target, msg.episodes);
        else if (msg.type === "episode_update") store.appendEpisode(target, msg);
        else if (msg.type === "checkpoint") store.appendCheckpoint(target, msg);
        else if (msg.type === "training_complete") {
          store.setFinalStats(target, msg);
          store.setStatus(target, "complete");
        }
      };

      ws.onerror = () => useCompareStore.getState().setStatus(target, "error");
      ws.onclose = () => {};
    },
    [target] // target is the only real dep
  );

  const stopTraining = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cancel" }));
    }
    useCompareStore.getState().setStatus(target, "idle");
  }, [target]);

  return { startTraining, stopTraining };
}