import { useState } from 'react';
import ConversationPane from './ConversationPane';
import ModelPicker from './ModelPicker';

export default function ChatSurface({ personaIds, model, setModel }: { personaIds: string[]; model: { providerId: string; modelId: string }; setModel: (v: { providerId: string; modelId: string }) => void }) {
  const [draft, setDraft] = useState('');

  function send() {
    if (!draft.trim()) return;
    const ev = personaIds.length === 1
      ? { type: 'user_message', personaId: personaIds[0], content: draft, ...model }
      : { type: 'demo_message', personaIds, content: draft, ...model };
    const fn = (window as unknown as Record<string, (arg: unknown) => void>).__datachat_send;
    if (fn) fn(ev);
    setDraft('');
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ── */}
      <div className="px-5 py-2.5 border-b border-gold-500/8 flex items-center gap-3 bg-ink-900/40">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold-500/40">Model</div>
        <ModelPicker value={model} onChange={setModel} />
        {personaIds.length > 1 && (
          <div className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] text-signal-white/25">
            {personaIds.length} panes
          </div>
        )}
      </div>

      {/* ── Conversation Grid ── */}
      <div className="flex-1 min-h-0 grid overflow-hidden" style={{ gridTemplateColumns: `repeat(${personaIds.length}, minmax(0,1fr))` }}>
        {personaIds.map((id, i) => (
          <div key={id} className={`min-h-0 min-w-0 overflow-hidden ${i < personaIds.length - 1 ? 'border-r border-gold-500/8' : ''}`}>
            <ConversationPane personaId={id} />
          </div>
        ))}
      </div>

      {/* ── Input Area ── */}
      <div className="border-t border-gold-500/10 bg-ink-900/60 backdrop-blur-sm p-4">
        <div className="flex gap-3 items-end max-w-5xl mx-auto">
          <div className="flex-1 relative">
            <input
              className="w-full bg-ink-800 border border-gold-500/12 rounded-lg px-4 py-3 font-body text-sm text-signal-white placeholder:text-signal-white/20 focus:border-gold-500/30 focus:ring-1 focus:ring-gold-500/15 transition-all"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask something about the database..."
            />
          </div>
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="bg-gradient-to-r from-gp-green to-gp-emerald hover:from-gp-green/90 hover:to-gp-emerald/90 disabled:from-ink-700 disabled:to-ink-700 disabled:text-signal-white/20 text-white rounded-lg px-5 py-3 text-sm font-mono font-medium uppercase tracking-wider transition-all duration-200 shadow-lg shadow-gp-green/10 disabled:shadow-none"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
