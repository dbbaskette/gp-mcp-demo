import type { ToolCall } from '../state/personaStore';
import { useState } from 'react';

const statusStyle: Record<string, string> = {
  pending: 'border-white/20 bg-surface-700',
  success: 'border-accent-green/50 bg-accent-green/10',
  error:   'border-accent-red/50 bg-accent-red/10',
  denied:  'border-accent-amber/50 bg-accent-amber/10',
};

export default function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded border p-3 my-2 font-mono text-xs ${statusStyle[call.status ?? 'pending']}`}>
      <div className="flex items-center justify-between">
        <div><span className="font-semibold">{call.name}</span> <span className="opacity-70">({call.status ?? 'pending'})</span></div>
        <button onClick={() => setOpen(!open)} className="text-xs underline">{open ? 'hide' : 'details'}</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {Object.entries((call.args ?? {}) as Record<string, unknown>).map(([k, v]) => (
          <span key={k} className="bg-surface-900/60 rounded px-2 py-0.5">{k}: {JSON.stringify(v)}</span>
        ))}
      </div>
      {open && (
        <pre className="mt-2 p-2 bg-black/30 rounded overflow-auto max-h-64">{JSON.stringify(call.result, null, 2)}</pre>
      )}
    </div>
  );
}
