"use client";
import { clsx } from "clsx";

interface TopBarProps {
  title: string;
  isConnected?: boolean;
}

export function TopBar({ title, isConnected }: TopBarProps) {
  return (
    <header className="h-12 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-950 shrink-0">
      <h1 className="text-sm font-semibold text-gray-100">{title}</h1>
      {isConnected !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span
            className={clsx(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500 animate-pulse" : "bg-gray-600"
            )}
          />
          <span className="text-gray-400">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      )}
    </header>
  );
}
