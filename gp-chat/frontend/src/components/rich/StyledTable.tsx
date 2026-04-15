export default function StyledTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gold-500/10 my-4 shadow-lg shadow-ink-950/30">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}
