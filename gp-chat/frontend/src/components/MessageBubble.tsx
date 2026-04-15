import type { Bubble } from '../state/personaStore';
import ToolCallCard from './ToolCallCard';
import { RichMarkdown } from '../rendering/richMarkdown';

export default function MessageBubble({ bubble, index }: { bubble: Bubble; index: number }) {
  if (bubble.role === 'user') {
    return (
      <div className="animate-slide-up flex justify-end" style={{ animationDelay: `${index * 30}ms` }}>
        <div className="max-w-[80%] bg-ink-700 border border-gold-500/10 rounded-xl rounded-br-sm px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-gold-500/40 mb-1">Query</div>
          <div className="text-sm text-signal-white/90 font-body">{bubble.text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ animationDelay: `${index * 30}ms` }}>
      <div className="max-w-[95%]">
        {/* Tool calls */}
        {bubble.toolCalls.length > 0 && (
          <div className="mb-2 space-y-2">
            {bubble.toolCalls.map(tc => <ToolCallCard key={tc.id} call={tc} />)}
          </div>
        )}

        {/* Response content */}
        {bubble.text && (
          <div className="bg-ink-800/50 border border-gold-500/8 rounded-xl rounded-bl-sm px-5 py-4">
            <div className="prose-invert text-sm font-body leading-relaxed text-signal-white/85">
              <RichMarkdown source={bubble.text} />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {!bubble.done && !bubble.text && (
          <div className="bg-ink-800/30 border border-gold-500/8 rounded-xl rounded-bl-sm px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500/40 animate-typing" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500/40 animate-typing" style={{ animationDelay: '200ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500/40 animate-typing" style={{ animationDelay: '400ms' }} />
              </div>
              <span className="text-xs font-mono text-gold-500/30 tracking-wider">Processing</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
