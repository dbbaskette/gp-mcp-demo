import { ReactNode } from 'react';

export default function Shell({ right, children }: { right?: ReactNode; children: ReactNode }) {
  return (
    <div className="h-full flex-1 min-w-0 flex flex-col bg-ink-950 bg-grid-fine">
      {/* ── Header ── */}
      <header className="h-14 px-5 flex items-center justify-between border-b border-gold-500/10 bg-ink-900/80 backdrop-blur-sm relative z-10">
        <div className="flex items-center gap-3">
          {/* Greenplum diamond icon */}
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-gp-green to-gp-emerald flex items-center justify-center shadow-lg shadow-gp-green/20">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14.5 8L8 15L1.5 8L8 1Z" fill="white" fillOpacity="0.9"/>
            </svg>
          </div>
          <div>
            <div className="font-display text-lg text-gold-300 leading-none">Data-Chat</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-500/50 mt-0.5">Greenplum Operations</div>
          </div>
        </div>
        <div className="flex items-center gap-3">{right}</div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-hidden relative">{children}</main>
    </div>
  );
}
