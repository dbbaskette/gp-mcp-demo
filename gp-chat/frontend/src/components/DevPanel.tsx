import { useEffect, useState, useRef } from 'react';
import { usePersonas } from '../state/personaStore';
import { openAuditStream } from '../api/audit';

type DevEvent = Record<string, unknown>;

const BADGE: Record<string, { bg: string; text: string }> = {
  tool: { bg: 'bg-signal-amber/15 border-signal-amber/25', text: 'text-signal-amber' },
  llm:  { bg: 'bg-gold-500/10 border-gold-500/20',        text: 'text-gold-400' },
  mcp:  { bg: 'bg-signal-cyan/15 border-signal-cyan/25',   text: 'text-signal-cyan' },
};

function Badge({ category }: { category: string }) {
  const s = BADGE[category] ?? { bg: 'bg-ink-700 border-signal-white/10', text: 'text-signal-white/50' };
  return <span className={`${s.bg} ${s.text} border text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider font-semibold`}>{category}</span>;
}

function LogEntry({ ev }: { ev: DevEvent }) {
  const cat = (ev.category as string) ?? 'tool';
  const ts = ev.at ? new Date(ev.at as string).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  if (cat === 'llm') {
    const phase = ev.phase as string;
    const color = phase === 'error' ? 'text-signal-red' : phase === 'done' ? 'text-gp-green' : 'text-gold-400';
    return (
      <div className="mb-2 pb-2 border-b border-gold-500/5 animate-fade-in">
        <div className="flex items-center gap-1.5">
          <Badge category="llm" />
          <span className="text-signal-cyan/70 font-mono text-[11px]">{String(ev.personaId)}</span>
          <span className={`${color} font-mono text-[11px] font-medium`}>{phase}</span>
          <span className="text-signal-white/20 font-mono text-[10px] ml-auto">{ts}</span>
        </div>
        <div className="ml-6 mt-0.5 font-mono text-[10px] text-signal-white/40">
          {String(ev.provider)}/{String(ev.model)}
          {(ev.durationMs as number) > 0 && <span className="text-gold-400/60 ml-2">{String(ev.durationMs)}ms</span>}
        </div>
        {ev.detail ? <div className="ml-6 mt-0.5 font-mono text-[10px] text-signal-white/25 truncate">{String(ev.detail)}</div> : null}
      </div>
    );
  }

  if (cat === 'mcp') {
    const action = ev.action as string;
    const detail = ev.detail ? String(ev.detail) : '';
    const tools = ev.tools as string[] | undefined;
    const color = action === 'error' || action === 'call_error' ? 'text-signal-red' : action === 'connected' ? 'text-gp-green' : 'text-signal-cyan';
    return (
      <div className="mb-2 pb-2 border-b border-gold-500/5 animate-fade-in">
        <div className="flex items-center gap-1.5">
          <Badge category="mcp" />
          <span className="text-signal-cyan/70 font-mono text-[11px]">{String(ev.personaId)}</span>
          <span className={`${color} font-mono text-[11px] font-medium`}>{action}</span>
          <span className="text-signal-white/20 font-mono text-[10px] ml-auto">{ts}</span>
        </div>
        {detail && <div className="ml-6 mt-0.5 font-mono text-[10px] text-signal-white/40">{detail}</div>}
        {tools && <div className="ml-6 mt-0.5 font-mono text-[9px] text-signal-white/20">{tools.join(' · ')}</div>}
      </div>
    );
  }

  return (
    <div className="mb-2 pb-2 border-b border-gold-500/5 animate-fade-in">
      <div className="flex items-center gap-1.5">
        <Badge category="tool" />
        <span className="text-signal-cyan/70 font-mono text-[11px]">{String(ev.personaId)}</span>
        <span className="text-gold-300 font-mono text-[11px] font-medium">{String(ev.tool)}</span>
        <span className={`font-mono text-[10px] ${ev.status === 'denied' ? 'text-signal-red' : 'text-signal-white/30'}`}>{String(ev.status)}</span>
        <span className="text-gold-500/40 font-mono text-[10px]">{String(ev.durationMs)}ms</span>
        <span className="text-signal-white/20 font-mono text-[10px] ml-auto">{ts}</span>
      </div>
    </div>
  );
}

export default function DevPanel({ onClose }: { onClose: () => void }) {
  const slots = usePersonas(s => s.slots);
  const [tab, setTab] = useState<'logs' | 'claims' | 'tools'>('logs');
  const [events, setEvents] = useState<DevEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const src = openAuditStream(ev => setEvents(a => [ev as DevEvent, ...a].slice(0, 500)));
    return () => src.close();
  }, []);

  const filtered = filter === 'all' ? events : events.filter(e => e.category === filter);

  const mcpTools: Record<string, string[]> = {};
  for (const ev of events) {
    if (ev.category === 'mcp' && ev.action === 'connected' && ev.tools) {
      const pid = ev.personaId as string;
      if (!mcpTools[pid]) mcpTools[pid] = ev.tools as string[];
    }
  }

  return (
    <aside className="h-full w-[480px] flex-shrink-0 bg-ink-900 border-l border-gold-500/10 overflow-hidden flex flex-col shadow-2xl shadow-ink-950/80 animate-slide-left">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-gold-500/10 bg-ink-900/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gold-500/10 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-gold-500/60">
              <rect width="4" height="4" rx="0.5"/>
              <rect x="6" width="4" height="4" rx="0.5" opacity="0.5"/>
              <rect y="6" width="4" height="4" rx="0.5" opacity="0.5"/>
              <rect x="6" y="6" width="4" height="4" rx="0.5" opacity="0.3"/>
            </svg>
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-gold-400">DevPanel</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-signal-white/20">⌘\</span>
          <button className="text-xs font-mono text-signal-white/30 hover:text-signal-white/60 transition-colors" onClick={onClose}>Close</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gold-500/8">
        {(['logs', 'claims', 'tools'] as const).map(t => (
          <button
            key={t}
            className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-[0.15em] transition-all ${
              tab === t
                ? 'text-gold-400 border-b-2 border-gold-500/40 bg-gold-500/5'
                : 'text-signal-white/25 hover:text-signal-white/40'
            }`}
            onClick={() => setTab(t)}
          >{t}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 text-xs font-mono" ref={logRef}>
        {tab === 'logs' && (
          <>
            <div className="flex gap-1 mb-3 sticky top-0 bg-ink-900 py-1.5 z-10">
              {['all', 'tool', 'llm', 'mcp'].map(f => (
                <button key={f}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all ${
                    filter === f
                      ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20'
                      : 'bg-ink-800 text-signal-white/25 border border-transparent hover:text-signal-white/40'
                  }`}
                  onClick={() => setFilter(f)}>{f}</button>
              ))}
              <button
                className="px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider bg-ink-800 text-signal-white/20 hover:text-signal-white/40 transition-colors ml-auto border border-transparent"
                onClick={() => setEvents([])}
              >Clear</button>
            </div>
            {filtered.length === 0 && (
              <div className="text-center mt-12 animate-fade-in">
                <div className="text-signal-white/15 font-mono text-xs">No events</div>
                <div className="text-signal-white/10 font-mono text-[10px] mt-1">Send a message to see activity</div>
              </div>
            )}
            {filtered.map((ev, i) => <LogEntry key={i} ev={ev} />)}
          </>
        )}

        {tab === 'claims' && (
          Object.entries(slots).filter(([, s]) => s.info?.loggedIn).length === 0
            ? <div className="text-center mt-12 text-signal-white/15 font-mono text-xs animate-fade-in">No authenticated sessions</div>
            : Object.entries(slots).filter(([, s]) => s.info?.loggedIn).map(([id, s]) => (
              <div key={id} className="mb-4 animate-fade-in">
                <div className="text-signal-cyan/70 font-mono text-[11px] uppercase tracking-wider mb-1.5">{id}</div>
                <pre className="bg-ink-950 border border-gold-500/8 rounded-lg p-3 overflow-auto text-[10px] text-signal-white/50 leading-relaxed">
                  {JSON.stringify(s.info?.claims, null, 2)}
                </pre>
              </div>
            ))
        )}

        {tab === 'tools' && (
          Object.keys(mcpTools).length === 0
            ? <div className="text-center mt-12 animate-fade-in">
                <div className="text-signal-white/15 font-mono text-xs">No tools discovered</div>
                <div className="text-signal-white/10 font-mono text-[10px] mt-1">Tool inventory appears after a chat triggers MCP</div>
              </div>
            : Object.entries(mcpTools).map(([pid, tools]) => (
              <div key={pid} className="mb-4 animate-fade-in">
                <div className="text-signal-cyan/70 font-mono text-[11px] uppercase tracking-wider mb-2">{pid}</div>
                <div className="bg-ink-950 border border-gold-500/8 rounded-lg p-3 space-y-1">
                  {tools.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-gp-green/50" />
                      <span className="text-gold-300/70 text-[11px]">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Footer */}
      <div className="h-8 px-4 flex items-center border-t border-gold-500/8 bg-ink-900/50">
        <span className="text-[10px] font-mono text-signal-white/15">{events.length} events captured</span>
      </div>
    </aside>
  );
}
