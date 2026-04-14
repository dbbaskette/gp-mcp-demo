export default function StyledTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden border border-white/10 my-3">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
