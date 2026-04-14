import { usePersonas } from '../state/personaStore';

export default function PersonaPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const personas = usePersonas(s => s.personas);
  return (
    <select className="bg-surface-700 rounded px-2 py-1 text-sm" value={value} onChange={e => onChange(e.target.value)}>
      {personas.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );
}
