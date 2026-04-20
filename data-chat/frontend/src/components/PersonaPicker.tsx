import { usePersonas } from '../state/personaStore';

/**
 * Persona selector — single-select, tabbed. Cobalt underline marks the active
 * persona; nothing competes with the wordmark for saturation.
 */
export default function PersonaPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const personas = usePersonas(s => s.personas);
  return (
    <div className="flex items-stretch">
      {personas.map(p => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            aria-pressed={active}
            className={`relative px-3 py-1.5 font-mono text-label-sm uppercase transition-colors
              ${active ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
          >
            {p.label}
            {active && (
              <span
                className="absolute left-2 right-2 -bottom-0.5 h-[2px] bg-cobalt origin-left animate-underline-in"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
