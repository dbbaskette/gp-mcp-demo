import { useEffect, useState, useRef } from 'react';
import { usePersonas } from '../state/personaStore';
import { openAuditStream } from '../api/audit';
import { logout, getPersona } from '../api/personas';

type DevEvent = Record<string, unknown>;

/**
 * DevPanel — a scrolling log in the left-column style of a tech-journal
 * debug pane: hairline headers, monospaced everything, cobalt/forest/cinnabar
 * status hues. Includes a cobalt scanline in the empty state per the
 * critique's "empty states as product moments" recommendation.
 */

const CATEGORY_COLORS: Record<string, string> = {
  tool: '#9e6a15', // saffron
  llm:  '#1e3a8a', // cobalt
  mcp:  '#1d5552', // teal
};

const CATEGORY_BG: Record<string, string> = {
  tool: 'rgba(158,106,21,0.10)',
  llm:  'rgba(30,58,138,0.10)',
  mcp:  'rgba(29,85,82,0.10)',
};

function Badge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? '#3a3632';
  const bg = CATEGORY_BG[category] ?? 'rgba(20,19,17,0.08)';
  return (
    <span
      className="font-mono text-[9px] px-1.5 py-0.5 uppercase tracking-[0.14em] font-semibold"
      style={{ color, background: bg }}
    >
      {category}
    </span>
  );
}

function phaseColor(phase: string) {
  if (phase === 'error') return '#b83a26';
  if (phase === 'done') return '#1f4a32';
  return '#1e3a8a';
}

function LogEntry({ ev }: { ev: DevEvent }) {
  const cat = (ev.category as string) ?? 'tool';
  const ts = ev.at
    ? new Date(ev.at as string).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  if (cat === 'llm') {
    const phase = ev.phase as string;
    return (
      <div className="mb-2 pb-2 border-b border-ink/12 animate-fade-in">
        <div className="flex items-center gap-2">
          <Badge category="llm" />
          <span className="text-ink-2 font-mono text-[11px]">{String(ev.personaId)}</span>
          <span className="font-mono text-[11px] font-semibold" style={{ color: phaseColor(phase) }}>
            {phase}
          </span>
          <span className="text-ink-3 font-mono text-[10px] ml-auto">{ts}</span>
        </div>
        <div className="ml-1 mt-1 font-mono text-[10px] text-ink-2">
          {String(ev.provider)}/{String(ev.model)}
          {(ev.durationMs as number) > 0 && (
            <span className="text-cobalt ml-3">{String(ev.durationMs)}ms</span>
          )}
        </div>
        {ev.detail ? (
          <div className="ml-1 mt-0.5 font-mono text-[10px] text-ink-3 truncate">{String(ev.detail)}</div>
        ) : null}
      </div>
    );
  }

  if (cat === 'mcp') {
    const action = ev.action as string;
    const detail = ev.detail ? String(ev.detail) : '';
    const tools = ev.tools as string[] | undefined;
    const actionColor =
      action === 'error' || action === 'call_error' ? '#b83a26'
      : action === 'connected' ? '#1f4a32'
      : '#1d5552';
    return (
      <div className="mb-2 pb-2 border-b border-ink/12 animate-fade-in">
        <div className="flex items-center gap-2">
          <Badge category="mcp" />
          <span className="text-ink-2 font-mono text-[11px]">{String(ev.personaId)}</span>
          <span className="font-mono text-[11px] font-semibold" style={{ color: actionColor }}>
            {action}
          </span>
          <span className="text-ink-3 font-mono text-[10px] ml-auto">{ts}</span>
        </div>
        {detail && <div className="ml-1 mt-1 font-mono text-[10px] text-ink-2">{detail}</div>}
        {tools && <div className="ml-1 mt-0.5 font-mono text-[10px] text-ink-3">{tools.join(' · ')}</div>}
      </div>
    );
  }

  return (
    <div className="mb-2 pb-2 border-b border-ink/12 animate-fade-in">
      <div className="flex items-center gap-2">
        <Badge category="tool" />
        <span className="text-ink-2 font-mono text-[11px]">{String(ev.personaId)}</span>
        <span className="text-ink font-mono text-[11px] font-semibold">{String(ev.tool)}</span>
        <span
          className="font-mono text-[10px]"
          style={{ color: ev.status === 'denied' ? '#b83a26' : ev.status === 'success' ? '#1f4a32' : '#3a3632' }}
        >
          {String(ev.status)}
        </span>
        <span className="text-cobalt font-mono text-[10px]">{String(ev.durationMs)}ms</span>
        <span className="text-ink-3 font-mono text-[10px] ml-auto">{ts}</span>
      </div>
    </div>
  );
}

export default function DevPanel({ onClose }: { onClose: () => void }) {
  const slots = usePersonas(s => s.slots);
  const setInfo = usePersonas(s => s.setInfo);
  const [tab, setTab] = useState<'logs' | 'claims' | 'tools'>('logs');
  const [events, setEvents] = useState<DevEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loggingOut, setLoggingOut] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  async function logoutEveryone() {
    const ids = Object.entries(slots)
      .filter(([, s]) => s.info?.loggedIn)
      .map(([id]) => id);
    if (ids.length === 0) return;
    setLoggingOut(true);
    try {
      await Promise.all(ids.map(id => logout(id).catch(() => {})));
      // Refresh auth state from server so UI reflects logout
      await Promise.all(ids.map(async id => {
        try { setInfo(id, await getPersona(id)); } catch { /* ignore */ }
      }));
    } finally {
      setLoggingOut(false);
    }
  }

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
    <aside className="h-full w-[440px] flex-shrink-0 bg-paper-2 border-l-2 border-ink/30 overflow-hidden flex flex-col animate-slide-left">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-ink/30">
        <div className="flex items-baseline gap-2">
          <span className="font-display italic text-display-sm text-ink leading-none">Dev</span>
          <span className="font-mono text-label-xs uppercase text-ink-3">panel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="kbd">⌘\</span>
          <button
            className="font-mono text-label-sm uppercase text-ink-2 hover:text-ink transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink/15">
        {(['logs', 'claims', 'tools'] as const).map(t => (
          <button
            key={t}
            className={`relative flex-1 py-2.5 font-mono text-label-sm uppercase transition-colors
              ${tab === t ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
            onClick={() => setTab(t)}
          >
            {t}
            {tab === t && <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-cobalt" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 text-xs font-mono" ref={logRef}>
        {tab === 'logs' && (
          <>
            <div className="flex gap-1 mb-3 sticky top-0 bg-paper-2 py-1 z-10">
              {['all', 'tool', 'llm', 'mcp'].map(f => (
                <button
                  key={f}
                  className={`px-2 py-1 font-mono text-label-xs uppercase transition-colors border
                    ${filter === f
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-transparent text-ink-2 border-ink/20 hover:border-ink/60 hover:text-ink'}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
              <button
                className="ml-auto px-2 py-1 font-mono text-label-xs uppercase text-ink-3 hover:text-ink transition-colors"
                onClick={() => setEvents([])}
              >
                Clear
              </button>
            </div>

            {filtered.length === 0 && (
              <EmptyScan label="No events" sub="Send a message to see tool calls, MCP handshakes, and model traffic." />
            )}
            {filtered.map((ev, i) => <LogEntry key={i} ev={ev} />)}
          </>
        )}

        {tab === 'claims' && (
          Object.entries(slots).filter(([, s]) => s.info?.loggedIn).length === 0
            ? <EmptyScan label="No sessions" sub="JWT claims appear here once a persona authenticates." />
            : Object.entries(slots).filter(([, s]) => s.info?.loggedIn).map(([id, s]) => (
              <div key={id} className="mb-4 animate-fade-in">
                <div className="font-mono text-label-sm uppercase text-cobalt mb-1.5">{id}</div>
                <pre className="bg-paper-3 border-l-2 border-cobalt p-3 overflow-auto text-[10px] text-ink leading-relaxed">
                  {JSON.stringify(s.info?.claims, null, 2)}
                </pre>
              </div>
            ))
        )}

        {tab === 'tools' && (
          Object.keys(mcpTools).length === 0
            ? <EmptyScan label="No tools discovered" sub="Inventory appears after a chat triggers an MCP handshake." />
            : Object.entries(mcpTools).map(([pid, tools]) => (
              <div key={pid} className="mb-4 animate-fade-in">
                <div className="font-mono text-label-sm uppercase text-cobalt mb-1.5">{pid}</div>
                <div className="bg-paper-3 border-l-2 border-cobalt p-3 space-y-1">
                  {tools.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="w-1 h-1 bg-cobalt" />
                      <span className="text-ink text-[11px]">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-ink/15 bg-paper-2/80 flex items-center justify-between gap-2">
        <span className="font-mono text-label-xs uppercase text-ink-3">
          {events.length} events captured
        </span>
        {(() => {
          const activeCount = Object.values(slots).filter(s => s.info?.loggedIn).length;
          const disabled = loggingOut || activeCount === 0;
          return (
            <button
              onClick={logoutEveryone}
              disabled={disabled}
              title={activeCount === 0 ? 'No active sessions' : `Log out ${activeCount} persona${activeCount === 1 ? '' : 's'}`}
              className={`px-2 py-1 font-mono text-label-xs uppercase border transition-colors
                ${disabled
                  ? 'border-ink/15 text-ink-3 cursor-not-allowed'
                  : 'border-cinnabar text-cinnabar hover:bg-cinnabar hover:text-paper'}`}
            >
              {loggingOut ? 'Logging out…' : `Log out all${activeCount > 0 ? ` (${activeCount})` : ''}`}
            </button>
          );
        })()}
      </div>
    </aside>
  );
}

/**
 * Empty-state with a slow cobalt scanline traveling down the field —
 * signals "listening, nothing to show yet" without being twee.
 */
function EmptyScan({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="relative h-48 border border-ink/15 overflow-hidden flex flex-col items-center justify-center text-center px-6 animate-fade-in">
      <div
        className="absolute left-0 right-0 h-6 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(30,58,138,0.16), transparent)',
          animation: 'scan 2.8s ease-in-out infinite',
        }}
      />
      <div className="font-display italic text-body-lg text-ink">{label}</div>
      <div className="mt-1 font-body text-label-sm text-ink-3 uppercase tracking-wider">{sub}</div>
    </div>
  );
}
