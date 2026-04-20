import { usePersonas } from '../state/personaStore';
import { loginUrl } from '../api/personas';
import MessageList from './MessageList';

/**
 * Persona-scoped conversation pane. One per persona in solo mode; N in
 * Compare mode. The pane header reads as a periodical's section rubric:
 * persona name on the left, connection state on the right, hairline below.
 *
 * Personas are differentiated by an accent *hue* (not by saturation), so the
 * single-color editorial system stays dominant while still being glanceable.
 */
const PERSONA_ACCENT: Record<string, string> = {
  viewer:  '#1d5552', // teal
  analyst: '#1e3a8a', // cobalt (our primary — analyst is "default" persona)
  dba:     '#5b2b7a', // plum
};

export default function ConversationPane({ personaId }: { personaId: string }) {
  const slot = usePersonas(s => s.slots[personaId]);
  const persona = usePersonas(s => s.personas.find(p => p.id === personaId));
  const info = slot?.info;
  const loggedIn = info?.loggedIn;
  const accent = PERSONA_ACCENT[personaId] ?? '#1e3a8a';

  if (!loggedIn) {
    return (
      <div className="h-full flex flex-col">
        <PaneHeader persona={persona?.label ?? personaId} accent={accent} state="offline" />
        <div className="flex-1 flex items-center justify-center animate-fade-in">
          <div className="text-center max-w-xs px-6">
            <div
              className="w-12 h-12 mx-auto mb-5 border border-ink/30 flex items-center justify-center"
              style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-2">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
              </svg>
            </div>
            <p className="font-body text-body text-ink-2 mb-6 leading-relaxed">
              {persona?.description ?? 'Authenticate to continue.'}
            </p>
            <button
              onClick={() => openLogin(personaId)}
              className="font-mono text-label-sm uppercase px-4 py-2 border border-ink text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              Authenticate
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PaneHeader persona={persona?.label ?? personaId} accent={accent} state="connected" />
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-[68ch]">
          <MessageList items={slot?.messages ?? []} />
        </div>
      </div>
    </div>
  );
}

function PaneHeader({ persona, accent, state }: { persona: string; accent: string; state: 'connected' | 'offline' }) {
  return (
    <div className="px-6 py-3 border-b border-ink/15 flex items-baseline gap-3">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: state === 'connected' ? accent : 'rgba(20,19,17,0.25)' }}
      />
      <span className="font-mono text-label-sm uppercase" style={{ color: state === 'connected' ? accent : '#6b655c' }}>
        {persona}
      </span>
      <span className="font-mono text-label-xs uppercase text-ink-3 ml-auto">
        {state}
      </span>
    </div>
  );
}

function openLogin(id: string) {
  const w = 480, h = 640;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;
  window.open(loginUrl(id), `login-${id}`, `width=${w},height=${h},left=${left},top=${top}`);
}
