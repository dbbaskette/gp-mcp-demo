import { usePersonas } from '../state/personaStore';

export default function PersonaPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const personas = usePersonas(s => s.personas);
  return (
    <div className="flex items-center gap-1.5">
      {personas.map(p => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`
              px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-all duration-200
              ${active
                ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30 shadow-sm shadow-gold-500/10'
                : 'text-signal-white/40 border border-transparent hover:text-signal-white/70 hover:border-gold-500/10'
              }
            `}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${active ? 'bg-gp-green' : 'bg-signal-white/20'}`} />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
