export default function RichCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gold-500/12 bg-gradient-to-br from-ink-800 to-ink-900 p-5 my-4 shadow-lg shadow-ink-950/50">
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-gold-400 to-gold-500/30" />
          <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-gold-400 font-semibold">{title}</div>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
