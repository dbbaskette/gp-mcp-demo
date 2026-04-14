import { useEffect, useState } from 'react';
import { listProviders, type Provider } from '../api/models';

export default function ModelPicker({ value, onChange }: { value: { providerId: string; modelId: string }; onChange: (v: { providerId: string; modelId: string }) => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => { listProviders().then(setProviders); }, []);
  return (
    <select
      className="bg-surface-700 rounded px-2 py-1 text-sm"
      value={`${value.providerId}::${value.modelId}`}
      onChange={e => { const [p, m] = e.target.value.split('::'); onChange({ providerId: p, modelId: m }); }}>
      {providers.flatMap(p => p.models.map(m => (
        <option key={`${p.id}::${m}`} value={`${p.id}::${m}`}>{p.id} / {m}</option>
      )))}
    </select>
  );
}
