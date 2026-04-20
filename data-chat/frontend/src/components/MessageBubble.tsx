import type { Bubble } from '../state/personaStore';
import ToolCallCard from './ToolCallCard';
import { RichMarkdown } from '../rendering/richMarkdown';

/**
 * Message bubble, editorial-interview style.
 *
 *   ASKED — the user's question, set in Fraunces italic, hanging left indent,
 *           cobalt left rule. Reads like an interviewer's question in a
 *           magazine transcript.
 *
 *   ANSWER — the assistant's reply, running body prose with the RichMarkdown
 *            typography system. No bubble, no border — it's the page itself.
 *            Tool calls sit *above* the prose as hairline log entries.
 */
export default function MessageBubble({ bubble, index }: { bubble: Bubble; index: number }) {
  const delay = `${index * 40}ms`;

  if (bubble.role === 'user') {
    return (
      <section
        className="animate-slide-up my-8 first:mt-2 pl-4 border-l-2 border-cobalt"
        style={{ animationDelay: delay }}
      >
        <div className="font-mono text-label-xs uppercase text-cobalt mb-1.5">Asked</div>
        <p className="font-display italic text-body-lg text-ink leading-[1.45]">
          {bubble.text}
        </p>
      </section>
    );
  }

  return (
    <section className="animate-slide-up my-6" style={{ animationDelay: delay }}>
      {/* Tool calls as a hairline log above the answer */}
      {bubble.toolCalls.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {bubble.toolCalls.map(tc => <ToolCallCard key={tc.id} call={tc} />)}
        </div>
      )}

      {bubble.text && (
        <>
          <div className="font-mono text-label-xs uppercase text-ink-3 mb-2">Answer</div>
          <div className="font-body text-body text-ink">
            <RichMarkdown source={bubble.text} />
          </div>
        </>
      )}

      {!bubble.done && !bubble.text && (
        <div className="flex items-center gap-2 py-2">
          <span className="font-mono text-label-xs uppercase text-ink-3">Thinking</span>
          <span className="flex gap-1">
            <span className="w-1 h-1 bg-ink-2 animate-typing" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-ink-2 animate-typing" style={{ animationDelay: '180ms' }} />
            <span className="w-1 h-1 bg-ink-2 animate-typing" style={{ animationDelay: '360ms' }} />
          </span>
        </div>
      )}
    </section>
  );
}
