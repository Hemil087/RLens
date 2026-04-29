"use client";
import { useCallback } from "react";
import { useTrainingStore } from "@/store/trainingStore";
import type { AlgorithmType } from "@/types";

// Module-level ref so every call to useTrainingSocket shares the same WebSocket
const wsRef = { current: null as WebSocket | null };

export function useTrainingSocket() {
  const store = useTrainingStore();

  const startTraining = useCallback(
    (algorithm: AlgorithmType, params: Record<string, number>) => {
      if (wsRef.current) wsRef.current.close();

      store.reset();
      store.setStatus("training");

      const ws = new WebSocket("ws://localhost:8000/ws/train");
      wsRef.current = ws;

      ws.onopen = () => {
        store.setIsConnected(true);
        ws.send(JSON.stringify({ type: "start_training", algorithm, params }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "episode_update") store.appendEpisode(msg);
        else if (msg.type === "checkpoint") store.appendCheckpoint(msg);
        else if (msg.type === "training_complete") {
          store.setFinalStats(msg);
          store.setStatus("complete");
          store.setIsConnected(false);
        }
      };

      ws.onerror = () => {
        store.setStatus("error");
        store.setIsConnected(false);
      };

      ws.onclose = () => store.setIsConnected(false);
    },
    [store]
  );

  const stopTraining = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cancel" }));
    }
    store.setStatus("idle");
    store.setIsConnected(false);
  }, [store]);

  return { startTraining, stopTraining };
}
