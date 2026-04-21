import { useEffect, useState } from 'react';
import { listProviders, type Provider } from '../api/models';

export default function ModelPicker({
  value, onChange,
}: {
  value: { providerId: string; modelId: string };
  onChange: (v: { providerId: string; modelId: string }) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    listProviders().then(ps => {
      setProviders(ps);
      if ((!value.providerId || !value.modelId) && ps.length > 0) {
        // Prefer Google Gemini when available, otherwise fall back to the first provider.
        const preferred = ps.find(p => p.id === 'google' && p.models.length > 0) ?? ps.find(p => p.models.length > 0);
        if (preferred) onChange({ providerId: preferred.id, modelId: preferred.models[0] });
      }
    });
  }, []);

  const options = providers.flatMap(p =>
    p.models.map(m => ({ key: `${p.id}::${m}`, providerId: p.id, modelId: m })),
  );

  return (
    <div className="relative">
      <select
        className="appearance-none bg-transparent border-b-2 border-ink/30 px-0.5 py-1 pr-6
                   font-mono text-label-sm uppercase text-ink cursor-pointer
                   hover:border-ink focus:border-cobalt transition-colors"
        value={`${value.providerId}::${value.modelId}`}
        onChange={e => {
          const [p, m] = e.target.value.split('::');
          onChange({ providerId: p, modelId: m });
        }}
      >
        {options.map(o => (
          <option key={o.key} value={o.key}>
            {o.providerId} / {o.modelId}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-2 pointer-events-none"
        fill="currentColor"
        viewBox="0 0 12 12"
      >
        <path d="M6 8L1 3h10L6 8z" />
      </svg>
    </div>
  );
}
