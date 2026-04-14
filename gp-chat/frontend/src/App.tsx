import { useEffect, useState } from 'react';
import Shell from './components/Shell';
import PersonaPicker from './components/PersonaPicker';
import ChatSurface from './components/ChatSurface';
import DevPanel from './components/DevPanel';
import { listPersonas, getPersona } from './api/personas';
import { openSocket } from './api/chatSocket';
import { usePersonas } from './state/personaStore';

export default function App() {
  const { setPersonas, setInfo, onEvent, appendUser, personas } = usePersonas();
  const [active, setActive] = useState<string>('');
  const [demoMode, setDemoMode] = useState(false);
  const [demoSelection, setDemoSelection] = useState<string[]>([]);
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    listPersonas().then(ps => { setPersonas(ps); if (!active && ps[0]) setActive(ps[0].id); });
  }, []);

  useEffect(() => {
    personas.forEach(p => getPersona(p.id).then(i => setInfo(p.id, i)));
  }, [personas.length]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'persona-login' && e.data.personaId) getPersona(e.data.personaId).then(i => setInfo(e.data.personaId, i));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const ws = openSocket(onEvent);
    (window as unknown as Record<string, unknown>).__gpchat_send = (ev: unknown) => {
      const msg = ev as Record<string, unknown>;
      if (msg.type === 'user_message') appendUser(msg.personaId as string, msg.content as string);
      if (msg.type === 'demo_message') (msg.personaIds as string[]).forEach(pid => appendUser(pid, msg.content as string));
      ws.send(JSON.stringify(ev));
    };
    return () => ws.close();
  }, [onEvent, appendUser]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.metaKey && e.key === '\\') setDevOpen(o => !o); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <>
      <Shell right={<>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={demoMode} onChange={e => setDemoMode(e.target.checked)} /> Demo
        </label>
        {!demoMode && <PersonaPicker value={active} onChange={setActive} />}
        {demoMode && (
          <div className="flex gap-2 text-sm">
            {personas.map(p => (
              <label key={p.id} className="flex items-center gap-1">
                <input type="checkbox"
                       checked={demoSelection.includes(p.id)}
                       onChange={e => setDemoSelection(s => e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id))} />
                {p.label}
              </label>
            ))}
          </div>
        )}
        <button className="text-sm opacity-70 hover:opacity-100" onClick={() => setDevOpen(o => !o)}>DevPanel</button>
      </>}>
        {demoMode
          ? (demoSelection.length > 0 ? <ChatSurface personaIds={demoSelection} /> : <div className="p-6 opacity-70">Select at least one persona to compare.</div>)
          : (active ? <ChatSurface personaIds={[active]} /> : null)}
      </Shell>
      {devOpen && <DevPanel onClose={() => setDevOpen(false)} />}
    </>
  );
}
