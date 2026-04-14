export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3 my-2">{children}</div>;
}
export function StatTile({ label, value, sub }: { label?: string; value?: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-surface-700 to-surface-800 p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/60">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-white/50 mt-1">{sub}</div>}
    </div>
  );
}
