"use client";
import { clsx } from "clsx";
import { useTrainingStore } from "@/store/trainingStore";

const config = {
  idle:     { label: "Idle",     dot: "bg-gray-500",                text: "text-gray-400"  },
  training: { label: "Training", dot: "bg-blue-400 animate-pulse",  text: "text-blue-400"  },
  complete: { label: "Complete", dot: "bg-green-400",               text: "text-green-400" },
  error:    { label: "Error",    dot: "bg-red-500",                 text: "text-red-400"   },
};

export function StatusBadge() {
  const { status } = useTrainingStore();
  const { label, dot, text } = config[status];

  return (
    <div className={clsx("flex items-center gap-1.5 text-xs font-medium transition-colors duration-500", text)}>
      <span className={clsx("w-2 h-2 rounded-full transition-all duration-500", dot)} />
      {label}
    </div>
  );
}
