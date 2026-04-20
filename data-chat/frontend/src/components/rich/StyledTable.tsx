/**
 * Tabular data, editorial style.
 *
 * No borders or rounded corners — a strong top rule, hairlines between rows,
 * a thicker bottom rule. Labels in uppercase mono, numerics in tabular-nums
 * mono. Follows the cream-on-paper rhythm of the rest of the app.
 *
 * Global `th`/`td` defaults live in index.css; this wrapper adds the horizontal
 * rules that bracket the table.
 */
export default function StyledTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 border-y-2 border-ink">
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {children}
        </table>
      </div>
    </div>
  );
}
