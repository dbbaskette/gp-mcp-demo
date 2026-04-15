import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import type { Bubble } from '../state/personaStore';

export default function MessageList({ items }: { items: Bubble[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="font-display text-xl text-gold-500/15 mb-1">Ready</div>
          <div className="text-xs font-mono text-signal-white/20 tracking-wider">Awaiting query</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((b, i) => <MessageBubble key={i} bubble={b} index={i} />)}
      <div ref={endRef} />
    </div>
  );
}
