"use client";
import { useEffect, useState } from "react";
import type { AlgorithmMeta } from "@/types";

let cache: AlgorithmMeta[] | null = null;
let promise: Promise<AlgorithmMeta[]> | null = null;

function fetchAlgorithms(): Promise<AlgorithmMeta[]> {
  if (!promise) {
    promise = fetch("http://localhost:8000/algorithms").then((r) => r.json());
    promise.then((data) => { cache = data; });
  }
  return promise;
}

export function useAlgorithmMeta() {
  const [algorithms, setAlgorithms] = useState<AlgorithmMeta[]>(cache ?? []);

  useEffect(() => {
    if (cache) return;
    fetchAlgorithms().then(setAlgorithms).catch(console.error);
  }, []);

  return algorithms;
}
