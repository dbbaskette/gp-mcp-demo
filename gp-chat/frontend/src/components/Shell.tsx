import { ReactNode } from 'react';
export default function Shell({ right, children }: { right?: ReactNode; children: ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <header className="h-12 px-4 flex items-center justify-between border-b border-white/10 bg-surface-800">
        <div className="font-semibold">gp-chat</div>
        <div className="flex items-center gap-2">{right}</div>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
