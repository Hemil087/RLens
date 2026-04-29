import { clsx } from "clsx";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className }: CardProps) {
  return (
    <div className={clsx("bg-gray-900 border border-gray-800 rounded-xl p-4", className)}>
      {title && (
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
