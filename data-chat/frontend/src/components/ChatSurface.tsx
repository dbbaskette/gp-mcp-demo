import { useRef, useState } from 'react';
import ConversationPane from './ConversationPane';
import ModelPicker from './ModelPicker';

/**
 * Chat surface. Input is the hero: full-width, bottom-anchored, deep
 * paper-2 field with a cobalt underline that scales in on focus. The send
 * action is a restrained "Send →" button — gains color only once the field
 * has content.
 */
export default function ChatSurface({
  personaIds, model, setModel,
}: {
  personaIds: string[];
  model: { providerId: string; modelId: string };
  setModel: (v: { providerId: string; modelId: string }) => void;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function send() {
    if (!draft.trim()) return;
    const ev = personaIds.length === 1
      ? { type: 'user_message', personaId: personaIds[0], content: draft, ...model }
      : { type: 'demo_message', personaIds, content: draft, ...model };
    const fn = (window as unknown as Record<string, (arg: unknown) => void>).__datachat_send;
    if (fn) fn(ev);
    setDraft('');
  }

  const ready = draft.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar: model + pane count ── */}
      <div className="px-6 py-3 flex items-center gap-4 border-b border-ink/15">
        <span className="font-mono text-label-xs uppercase text-ink-3">Model</span>
        <ModelPicker value={model} onChange={setModel} />
        {personaIds.length > 1 && (
          <div className="ml-auto flex items-center gap-3 font-mono text-label-xs uppercase text-ink-3">
            <span className="hairline-rule w-6 h-px" />
            <span>Applies to all {personaIds.length} panes</span>
          </div>
        )}
      </div>

      {/* ── Conversation Grid ── */}
      <div
        className="flex-1 min-h-0 grid overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${personaIds.length}, minmax(0,1fr))` }}
      >
        {personaIds.map((id, i) => (
          <div
            key={id}
            className={`min-h-0 min-w-0 overflow-hidden ${i < personaIds.length - 1 ? 'border-r border-ink/15' : ''}`}
          >
            <ConversationPane personaId={id} />
          </div>
        ))}
      </div>

      {/* ── Input hero ── */}
      <div className="relative border-t border-ink/30 bg-paper-2/60">
        <div className="max-w-[920px] mx-auto px-6 py-5">
          <label className="flex items-start gap-4">
            <span className="font-display italic text-ink-3 text-body-lg pt-0.5 select-none" aria-hidden>Ask.</span>
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={e => {
                setDraft(e.target.value);
                const el = e.target as HTMLTextAreaElement;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 180) + 'px';
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="What's the row count of web_sales? Which tables am I allowed to see?"
              className="flex-1 bg-transparent font-body text-body-lg text-ink placeholder:text-ink-3/80 resize-none outline-none leading-[1.5]"
            />
            <button
              type="button"
              onClick={send}
              disabled={!ready}
              className={`shrink-0 self-start font-mono text-label-sm uppercase px-4 py-2 border transition-all
                ${ready
                  ? 'bg-cobalt text-paper border-cobalt hover:bg-cobalt-dark'
                  : 'bg-transparent text-ink-3 border-ink/20 cursor-not-allowed'}`}
              aria-label="Send message"
            >
              Send&nbsp;→
            </button>
          </label>
          {/* Animated underline — scales in on focus, stays thin when idle */}
          <div className="relative mt-3 h-[2px]">
            <span className="absolute inset-0 bg-ink/20" />
            <span
              className={`absolute inset-0 bg-cobalt origin-left transition-transform duration-300 ease-out
                ${focused || ready ? 'scale-x-100' : 'scale-x-0'}`}
            />
          </div>

          {/* Keyboard hint */}
          <div className="mt-2 flex items-center justify-between font-mono text-label-xs uppercase text-ink-3">
            <span>↵ to send · shift+↵ for newline</span>
            <span>{draft.length > 0 && `${draft.length} chars`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
