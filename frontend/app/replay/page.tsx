"use client";
import { useEffect, useRef } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/shared/Card";
import { ReplayControls } from "@/components/replay/ReplayControls";
import { ReplayViewer } from "@/components/replay/ReplayViewer";
import { ReplayStats } from "@/components/replay/ReplayStats";
import { useReplayStore } from "@/store/replayStore";

export default function ReplayPage() {
  const { gifData } = useReplayStore();
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && gifData) {
        e.preventDefault();
        const img = document.querySelector<HTMLImageElement>("img[alt='Episode replay']");
        if (img) {
          const src = img.src;
          img.src = "";
          requestAnimationFrame(() => { img.src = src; });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gifData]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Replay" />
      <div className="flex flex-col gap-4 p-4 overflow-auto max-w-2xl mx-auto w-full">
        <Card title="Load Episode">
          <ReplayControls />
        </Card>
        <Card title="Episode Replay">
          <ReplayViewer />
          {gifData && (
            <p className="text-xs text-gray-600 text-center mt-2">Press Space to restart GIF</p>
          )}
        </Card>
        <Card title="Stats">
          <ReplayStats />
        </Card>
      </div>
    </div>
  );
}
