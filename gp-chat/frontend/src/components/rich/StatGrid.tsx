export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3 my-3">{children}</div>;
}

export function StatTile({ label, value, sub }: { label?: string; value?: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-ink-800 border border-gold-500/8 p-4 transition-colors hover:border-gold-500/15">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold-500/50 mb-1">{label}</div>
      <div className="text-2xl font-display text-gold-300">{value}</div>
      {sub && <div className="text-[11px] font-mono text-signal-white/35 mt-1">{sub}</div>}
    </div>
  );
}
