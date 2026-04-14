import { usePersonas } from '../state/personaStore';
import { loginUrl } from '../api/personas';
import MessageList from './MessageList';

export default function ConversationPane({ personaId }: { personaId: string }) {
  const slot = usePersonas(s => s.slots[personaId]);
  const info = slot?.info;
  if (!info?.loggedIn) {
    return (
      <div className="h-full flex items-center justify-center">
        <button className="bg-accent-blue hover:bg-accent-blue/80 rounded px-4 py-2" onClick={() => openLogin(personaId)}>
          Log in as {personaId}
        </button>
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto p-4">
      <MessageList items={slot?.messages ?? []} />
    </div>
  );
}

function openLogin(id: string) {
  const w = 480, h = 640;
  const left = window.screenX + (window.outerWidth  - w) / 2;
  const top  = window.screenY + (window.outerHeight - h) / 2;
  window.open(loginUrl(id), `login-${id}`, `width=${w},height=${h},left=${left},top=${top}`);
}
