import MessageBubble from './MessageBubble';
import type { Bubble } from '../state/personaStore';

export default function MessageList({ items }: { items: Bubble[] }) {
  return <div className="flex flex-col">{items.map((b, i) => <MessageBubble key={i} bubble={b} />)}</div>;
}
