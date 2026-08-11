"use client";
import { useCallback } from "react";
import { useTrainingStore } from "@/store/trainingStore";
import type { AlgorithmType } from "@/types";

// Module-level ref so every call to useTrainingSocket shares the same WebSocket
const wsRef = { current: null as WebSocket | null };

// P2: this hook doesn't render anything derived from state, so it should not
// subscribe to the store at all. Reading via `getState()` inside handlers
// keeps `startTraining` / `stopTraining` referentially stable across renders.
export function useTrainingSocket() {
  const startTraining = useCallback(
    (algorithm: AlgorithmType, params: Record<string, number>) => {
      const s = useTrainingStore.getState();

      if (wsRef.current) wsRef.current.close();

      s.reset();
      s.setStatus("training");

      const ws = new WebSocket("ws://localhost:8000/ws/train");
      wsRef.current = ws;

      ws.onopen = () => {
        useTrainingStore.getState().setIsConnected(true);
        ws.send(JSON.stringify({ type: "start_training", algorithm, params }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const store = useTrainingStore.getState();
        if (msg.type === "episode_batch") store.appendEpisodeBatch(msg.episodes);
        else if (msg.type === "episode_update") store.appendEpisode(msg);
        else if (msg.type === "checkpoint") store.appendCheckpoint(msg);
        else if (msg.type === "training_complete") {
          store.setFinalStats(msg);
          store.setStatus("complete");
          store.setIsConnected(false);
        }
      };

      ws.onerror = () => {
        const store = useTrainingStore.getState();
        store.setStatus("error");
        store.setIsConnected(false);
      };

      ws.onclose = () => useTrainingStore.getState().setIsConnected(false);
    },
    [] // empty deps — actions are stable on the store
  );

  const stopTraining = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cancel" }));
    }
    const s = useTrainingStore.getState();
    s.setStatus("idle");
    s.setIsConnected(false);
  }, []);

  return { startTraining, stopTraining };
}