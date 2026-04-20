import { useEffect, useState } from 'react';
import Shell from './components/Shell';
import PersonaPicker from './components/PersonaPicker';
import ChatSurface from './components/ChatSurface';
import DevPanel from './components/DevPanel';
import { listPersonas, getPersona, loginUrl } from './api/personas';
import { openSocket, type Outbound } from './api/chatSocket';
import { usePersonas } from './state/personaStore';

export default function App() {
  const { setPersonas, setInfo, onEvent, appendUser, personas } = usePersonas();
  const [active, setActive] = useState<string>('');
  const [demoMode, setDemoMode] = useState(false);
  const [demoSelection, setDemoSelection] = useState<string[]>([]);
  const [devOpen, setDevOpen] = useState(false);
  const [model, setModel] = useState({ providerId: '', modelId: '' });

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
    const handleEvent = (ev: Outbound) => {
      onEvent(ev);
      // Auto-open login popup when auth is required
      if (ev.type === 'auth_required' && ev.personaId) {
        const w = 480, h = 640;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(loginUrl(ev.personaId), `login-${ev.personaId}`, `width=${w},height=${h},left=${left},top=${top}`);
      }
    };
    const ws = openSocket(handleEvent);
    (window as unknown as Record<string, unknown>).__datachat_send = (ev: unknown) => {
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
    <div className="h-full flex">
      <Shell right={<>
        {/* Demo toggle */}
        <button onClick={() => setDemoMode(d => !d)} className="flex items-center gap-2 cursor-pointer group">
          <div className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${demoMode ? 'bg-gp-green/30' : 'bg-ink-700'}`}>
            <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200"
                 style={{ left: demoMode ? '18px' : '2px', background: demoMode ? '#2ecc71' : 'rgba(232,228,221,0.3)' }} />
          </div>
          <span className="text-xs font-mono uppercase tracking-wider text-signal-white/40 group-hover:text-signal-white/60 transition-colors">
            Compare
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gold-500/10" />

        {/* Persona selection */}
        {!demoMode && <PersonaPicker value={active} onChange={setActive} />}
        {demoMode && (
          <div className="flex gap-1.5">
            {personas.map(p => {
              const sel = demoSelection.includes(p.id);
              return (
                <button key={p.id}
                  onClick={() => setDemoSelection(s => sel ? s.filter(x => x !== p.id) : [...s, p.id])}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                    sel
                      ? 'bg-gp-green/15 text-gp-green border border-gp-green/30'
                      : 'text-signal-white/40 border border-transparent hover:text-signal-white/60 hover:border-gold-500/10'
                  }`}>
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-gold-500/10" />

        {/* DevPanel toggle */}
        <button
          onClick={() => setDevOpen(o => !o)}
          className={`px-2.5 py-1.5 rounded-md text-xs font-mono transition-all duration-200 ${
            devOpen
              ? 'bg-gold-500/15 text-gold-400 border border-gold-500/30'
              : 'text-signal-white/30 hover:text-signal-white/50 border border-transparent hover:border-gold-500/10'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="1" width="4" height="4" rx="0.5" opacity="0.6"/>
              <rect x="7" y="1" width="4" height="4" rx="0.5" opacity="0.4"/>
              <rect x="1" y="7" width="4" height="4" rx="0.5" opacity="0.4"/>
              <rect x="7" y="7" width="4" height="4" rx="0.5" opacity="0.8"/>
            </svg>
            Dev
          </span>
        </button>
      </>}>
        {demoMode
          ? (demoSelection.length > 0
            ? <ChatSurface personaIds={demoSelection} model={model} setModel={setModel} />
            : <div className="h-full flex items-center justify-center">
                <div className="text-center animate-fade-in">
                  <div className="font-display text-2xl text-gold-500/30 mb-2">Select Personas</div>
                  <div className="text-sm text-signal-white/30 font-body">Choose two or more personas above to compare their access levels</div>
                </div>
              </div>)
          : (active ? <ChatSurface personaIds={[active]} model={model} setModel={setModel} /> : null)}
      </Shell>
      {devOpen && <DevPanel onClose={() => setDevOpen(false)} />}
    </div>
  );
}
