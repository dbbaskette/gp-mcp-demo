export default function RichCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-gradient-to-br from-surface-800 to-surface-900 p-4 my-3">
      {title && <div className="text-xs uppercase tracking-wider text-accent-blue font-semibold mb-3">{title}</div>}
      <div>{children}</div>
    </div>
  );
}
