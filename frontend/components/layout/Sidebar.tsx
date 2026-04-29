"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { BarChart2, GitCompare, Play } from "lucide-react";

const links = [
  { href: "/train", label: "Train", icon: BarChart2 },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/replay", label: "Replay", icon: Play },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 md:w-48 bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-2 md:px-4 shrink-0">
      <div className="mb-8 px-2 hidden md:block">
        <span className="text-indigo-400 font-bold text-lg tracking-tight">RLens</span>
        <span className="text-gray-500 text-xs block">RL Dashboard</span>
      </div>
      <div className="md:hidden mb-8 flex justify-center">
        <span className="text-indigo-400 font-bold text-sm">RL</span>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="hidden md:block">{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
