import { usePersonas } from '../state/personaStore';
import { loginUrl } from '../api/personas';
import MessageList from './MessageList';

const PERSONA_COLORS: Record<string, string> = {
  viewer:  'from-signal-cyan/20 to-signal-cyan/5 border-signal-cyan/20',
  analyst: 'from-gold-500/20 to-gold-500/5 border-gold-500/20',
  dba:     'from-purple-500/20 to-purple-500/5 border-purple-500/20',
};

const PERSONA_DOTS: Record<string, string> = {
  viewer:  'bg-signal-cyan',
  analyst: 'bg-gold-500',
  dba:     'bg-purple-500',
};

export default function ConversationPane({ personaId }: { personaId: string }) {
  const slot = usePersonas(s => s.slots[personaId]);
  const persona = usePersonas(s => s.personas.find(p => p.id === personaId));
  const info = slot?.info;
  const loggedIn = info?.loggedIn;

  const colorClass = PERSONA_COLORS[personaId] ?? 'from-gold-500/20 to-gold-500/5 border-gold-500/20';
  const dotClass = PERSONA_DOTS[personaId] ?? 'bg-gold-500';

  if (!loggedIn) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-gold-500/8 bg-ink-900/30">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dotClass} opacity-30`} />
            <span className="text-xs font-mono uppercase tracking-wider text-signal-white/40">{persona?.label ?? personaId}</span>
            <span className="text-[10px] font-mono text-signal-white/20 ml-auto">offline</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center animate-fade-in">
          <div className="text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br ${colorClass} border flex items-center justify-center`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-signal-white/40">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
              </svg>
            </div>
            <div className="text-sm text-signal-white/30 mb-4 font-body">{persona?.description ?? 'Authenticate to continue'}</div>
            <button
              onClick={() => openLogin(personaId)}
              className={`bg-gradient-to-br ${colorClass} border rounded-lg px-5 py-2.5 text-sm font-mono uppercase tracking-wider text-signal-white/80 hover:text-signal-white transition-all duration-200 hover:shadow-lg`}
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
      <div className="px-4 py-3 border-b border-gold-500/8 bg-ink-900/30">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotClass} animate-pulse-glow`} />
          <span className="text-xs font-mono uppercase tracking-wider text-signal-white/60">{persona?.label ?? personaId}</span>
          <span className="text-[10px] font-mono text-gp-green/60 ml-auto">connected</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <MessageList items={slot?.messages ?? []} />
      </div>
    </div>
  );
}

function openLogin(id: string) {
  const w = 480, h = 640;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;
  window.open(loginUrl(id), `login-${id}`, `width=${w},height=${h},left=${left},top=${top}`);
}
