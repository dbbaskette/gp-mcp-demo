import type { ToolCall } from '../state/personaStore';
import { useState } from 'react';

function getStatusStyle(status: string | undefined) {
  switch (status) {
    case 'success': return { border: 'border-gp-green/30', bg: 'bg-gp-green/5', icon: '\u2713', label: 'Success' };
    case 'error':   return { border: 'border-signal-red/30', bg: 'bg-signal-red/5', icon: '\u2715', label: 'Error' };
    case 'denied':  return { border: 'border-signal-amber/30', bg: 'bg-signal-amber/5', icon: '\u2298', label: 'Denied' };
    default:        return { border: 'border-gold-500/15', bg: 'bg-gold-500/5', icon: '\u27F3', label: 'Executing' };
  }
}

export default function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const s = getStatusStyle(call.status);

  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} overflow-hidden animate-fade-in`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${call.status === 'pending' ? 'animate-spin inline-block' : ''}`}>{s.icon}</span>
          <span className="font-mono text-xs font-semibold text-gold-300">{call.name}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-signal-white/30">{s.label}</span>
        </div>
        {call.result != null && (
          <button
            onClick={() => setOpen(!open)}
            className="text-[10px] font-mono text-gold-500/40 hover:text-gold-500/70 transition-colors uppercase tracking-wider"
          >
            {open ? 'Hide' : 'Details'}
          </button>
        )}
      </div>

      {/* Args */}
      {call.args != null && Object.keys(call.args as Record<string, unknown>).length > 0 && (
        <div className="px-3 pb-2.5 flex flex-wrap gap-1">
          {Object.entries((call.args ?? {}) as Record<string, unknown>).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 bg-ink-950/50 rounded px-2 py-0.5 text-[10px] font-mono">
              <span className="text-gold-500/50">{k}</span>
              <span className="text-signal-white/50">{JSON.stringify(v)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Result */}
      {open && (
        <div className="border-t border-gold-500/8">
          <pre className="p-3 text-[11px] font-mono text-signal-white/50 overflow-auto max-h-64 leading-relaxed">
            {JSON.stringify(call.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
