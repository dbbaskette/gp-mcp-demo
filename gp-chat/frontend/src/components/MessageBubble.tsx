import type { Bubble } from '../state/personaStore';
import ToolCallCard from './ToolCallCard';
import { RichMarkdown } from '../rendering/richMarkdown';

export default function MessageBubble({ bubble }: { bubble: Bubble }) {
  if (bubble.role === 'user') {
    return <div className="bg-surface-800 rounded-lg px-4 py-3 my-2"><strong>You:</strong> {bubble.text}</div>;
  }
  return (
    <div className="rounded-lg px-4 py-3 my-2 border border-white/10">
      {bubble.toolCalls.map(tc => <ToolCallCard key={tc.id} call={tc} />)}
      <RichMarkdown source={bubble.text} />
      {!bubble.done && <span className="text-xs opacity-60 animate-pulse">thinking...</span>}
    </div>
  );
}
