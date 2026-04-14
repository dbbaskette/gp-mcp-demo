import { useEffect, useState } from 'react';
import { usePersonas } from '../state/personaStore';
import { openAuditStream } from '../api/audit';

export default function DevPanel({ onClose }: { onClose: () => void }) {
  const slots = usePersonas(s => s.slots);
  const [tab, setTab] = useState<'claims' | 'audit' | 'tools'>('claims');
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const src = openAuditStream(ev => setAudit(a => [ev as Record<string, unknown>, ...a].slice(0, 200)));
    return () => src.close();
  }, []);

  return (
    <aside className="fixed top-0 right-0 h-full w-[420px] bg-surface-800 border-l border-white/10 overflow-hidden flex flex-col z-50">
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/10">
        <div className="font-semibold">DevPanel</div>
        <button className="text-sm opacity-70" onClick={onClose}>close</button>
      </div>
      <div className="flex border-b border-white/10 text-sm">
        {(['claims', 'audit', 'tools'] as const).map(t => (
          <button key={t} className={`flex-1 py-2 ${tab === t ? 'bg-surface-700' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 text-xs font-mono">
        {tab === 'claims' && Object.entries(slots).filter(([, s]) => s.info?.loggedIn).map(([id, s]) => (
          <div key={id} className="mb-3">
            <div className="text-accent-blue">{id}</div>
            <pre className="bg-black/30 p-2 rounded overflow-auto">{JSON.stringify(s.info?.claims, null, 2)}</pre>
          </div>
        ))}
        {tab === 'audit' && audit.map((a, i) => (
          <div key={i} className="mb-2 border-b border-white/5 pb-1">
            <span className="text-accent-green">{a.personaId as string}</span> {a.tool as string} <span className="opacity-60">{a.status as string}</span> {a.durationMs as number}ms
          </div>
        ))}
        {tab === 'tools' && <div className="opacity-70">(shows MCP tool inventory per persona after login)</div>}
      </div>
    </aside>
  );
}
