import { useEffect, useState } from 'react';
import Shell from './components/Shell';
import PersonaPicker from './components/PersonaPicker';
import ChatSurface from './components/ChatSurface';
import DevPanel from './components/DevPanel';
import EmptyPersonas from './components/EmptyPersonas';
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
      <Shell right={<HeaderControls
        demoMode={demoMode} setDemoMode={setDemoMode}
        active={active} setActive={setActive}
        demoSelection={demoSelection} setDemoSelection={setDemoSelection}
        personas={personas}
        devOpen={devOpen} setDevOpen={setDevOpen}
      />}>
        {demoMode
          ? (demoSelection.length >= 2
              ? <ChatSurface personaIds={demoSelection} model={model} setModel={setModel} />
              : <EmptyPersonas chosen={demoSelection.length} />)
          : (active ? <ChatSurface personaIds={[active]} model={model} setModel={setModel} /> : null)}
      </Shell>
      {devOpen && <DevPanel onClose={() => setDevOpen(false)} />}
    </div>
  );
}

/**
 * Header-right cluster. Two interaction surfaces (toggle + kbd-button),
 * distinct shapes — not three competing pill styles.
 */
function HeaderControls({
  demoMode, setDemoMode, active, setActive, demoSelection, setDemoSelection,
  personas, devOpen, setDevOpen,
}: {
  demoMode: boolean; setDemoMode: (v: boolean | ((d: boolean) => boolean)) => void;
  active: string; setActive: (v: string) => void;
  demoSelection: string[]; setDemoSelection: (fn: (s: string[]) => string[]) => void;
  personas: { id: string; label: string }[];
  devOpen: boolean; setDevOpen: (fn: (o: boolean) => boolean) => void;
}) {
  return (
    <>
      {/* Compare toggle — cobalt rail when on */}
      <button
        onClick={() => setDemoMode(d => !d)}
        className="flex items-center gap-2 group"
        aria-pressed={demoMode}
      >
        <span className={`relative w-9 h-4 transition-colors duration-200 ${demoMode ? 'bg-cobalt' : 'bg-ink/15'}`}>
          <span
            className="absolute top-0.5 w-3 h-3 bg-paper transition-all duration-200"
            style={{ left: demoMode ? '22px' : '2px' }}
          />
        </span>
        <span className="font-mono text-label-sm uppercase text-ink-2 group-hover:text-ink">
          Compare
        </span>
      </button>

      <span className="hairline-rule w-px h-5" />

      {!demoMode
        ? <PersonaPicker value={active} onChange={setActive} />
        : (
          <div className="flex gap-1">
            {personas.map(p => {
              const sel = demoSelection.includes(p.id);
              return (
                <button key={p.id}
                  onClick={() => setDemoSelection(s => sel ? s.filter(x => x !== p.id) : [...s, p.id])}
                  className={`px-3 py-1.5 font-mono text-label-sm uppercase transition-colors border
                    ${sel
                      ? 'bg-cobalt text-paper border-cobalt'
                      : 'bg-transparent text-ink-2 border-ink/30 hover:text-ink hover:border-ink/60'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )
      }

      <span className="hairline-rule w-px h-5" />

      {/* Dev toggle with visible kbd affordance */}
      <button
        onClick={() => setDevOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 font-mono text-label-sm uppercase transition-colors border
          ${devOpen
            ? 'bg-ink text-paper border-ink'
            : 'bg-transparent text-ink-2 border-ink/30 hover:text-ink hover:border-ink/60'}`}
        aria-pressed={devOpen}
      >
        <span>Dev</span>
        <span className={`kbd ${devOpen ? '!bg-paper/20 !border-paper/40 !text-paper' : ''}`}>⌘\</span>
      </button>
    </>
  );
}
