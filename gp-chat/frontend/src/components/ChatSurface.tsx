import { useState } from 'react';
import ConversationPane from './ConversationPane';
import ModelPicker from './ModelPicker';

export default function ChatSurface({ personaIds }: { personaIds: string[] }) {
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState({ providerId: 'openai', modelId: 'gpt-4o-mini' });

  function send() {
    if (!draft.trim()) return;
    const ev = personaIds.length === 1
      ? { type: 'user_message', personaId: personaIds[0], content: draft, ...model }
      : { type: 'demo_message', personaIds, content: draft, ...model };
    const fn = (window as unknown as Record<string, (arg: unknown) => void>).__gpchat_send;
    if (fn) fn(ev);
    setDraft('');
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-white/10 flex items-center gap-3">
        <ModelPicker value={model} onChange={setModel} />
      </div>
      <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${personaIds.length}, minmax(0,1fr))` }}>
        {personaIds.map(id => <div key={id} className="h-full min-w-0 border-r border-white/10 last:border-r-0"><ConversationPane personaId={id} /></div>)}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex gap-2">
          <input className="flex-1 bg-surface-700 rounded px-3 py-2" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask something..." />
          <button className="bg-accent-blue rounded px-4 py-2" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}
