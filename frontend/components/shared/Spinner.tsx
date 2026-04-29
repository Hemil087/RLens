export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-gray-400">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
