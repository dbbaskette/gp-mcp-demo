import { useEffect, useState } from 'react';
import { listProviders, type Provider } from '../api/models';

export default function ModelPicker({ value, onChange }: { value: { providerId: string; modelId: string }; onChange: (v: { providerId: string; modelId: string }) => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    listProviders().then(ps => {
      setProviders(ps);
      // Auto-select first model if none selected
      if ((!value.providerId || !value.modelId) && ps.length > 0 && ps[0].models.length > 0) {
        onChange({ providerId: ps[0].id, modelId: ps[0].models[0] });
      }
    });
  }, []);

  const options = providers.flatMap(p => p.models.map(m => ({ key: `${p.id}::${m}`, providerId: p.id, modelId: m })));

  return (
    <div className="relative">
      <select
        className="appearance-none bg-ink-800 border border-gold-500/15 rounded-md px-3 py-1.5 pr-7 text-xs font-mono text-gold-400 tracking-wide cursor-pointer hover:border-gold-500/30 transition-colors focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/20"
        value={`${value.providerId}::${value.modelId}`}
        onChange={e => { const [p, m] = e.target.value.split('::'); onChange({ providerId: p, modelId: m }); }}>
        {options.map(o => (
          <option key={o.key} value={o.key}>{o.providerId} / {o.modelId}</option>
        ))}
      </select>
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gold-500/40 pointer-events-none" fill="currentColor" viewBox="0 0 12 12">
        <path d="M6 8L1 3h10L6 8z"/>
      </svg>
    </div>
  );
}
