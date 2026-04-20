import type { ToolCall } from '../state/personaStore';
import { useState } from 'react';

/**
 * Tool-call log entry.
 *
 * Instead of a bubble-styled card, we render each tool call as a single
 * line with a status marker and a collapsible detail pane — reads like a
 * server log entry above the editorial answer.
 */
function getStatus(status: string | undefined) {
  switch (status) {
    case 'success': return { color: '#1f4a32', label: 'OK',       glyph: '●' };
    case 'error':   return { color: '#b83a26', label: 'ERROR',    glyph: '▲' };
    case 'denied':  return { color: '#9e6a15', label: 'DENIED',   glyph: '◆' };
    default:        return { color: '#1e3a8a', label: 'RUNNING',  glyph: '○' };
  }
}

export default function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const s = getStatus(call.status);
  const hasResult = call.result != null;

  return (
    <div className="border-l-2 pl-3 py-1.5 bg-paper-2/60 animate-fade-in" style={{ borderColor: s.color }}>
      {/* Header line */}
      <div className="flex items-baseline gap-3 font-mono text-label-sm">
        <span className={`${call.status === 'pending' ? 'animate-pulse' : ''}`} style={{ color: s.color }}>
          {s.glyph}
        </span>
        <span className="uppercase text-ink-3 text-label-xs" style={{ color: s.color }}>
          {s.label}
        </span>
        <span className="text-ink font-semibold">{call.name}</span>
        {hasResult && (
          <button
            onClick={() => setOpen(!open)}
            className="ml-auto uppercase text-label-xs text-ink-3 hover:text-ink transition-colors"
          >
            {open ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>

      {/* Args — small key=value list */}
      {call.args != null && Object.keys(call.args as Record<string, unknown>).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-label-xs">
          {Object.entries((call.args ?? {}) as Record<string, unknown>).map(([k, v]) => (
            <span key={k}>
              <span className="text-ink-3">{k}</span>
              <span className="text-ink-3 mx-1">=</span>
              <span className="text-ink">{JSON.stringify(v)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Result */}
      {open && hasResult && (
        <pre className="mt-2 p-3 bg-paper-3 text-[12px] text-ink overflow-auto max-h-64 leading-relaxed font-mono">
          {JSON.stringify(call.result, null, 2)}
        </pre>
      )}
    </div>
  );
}
