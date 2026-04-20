import { ReactNode } from 'react';

/**
 * Top-level app chrome. Wordmark-led header in the editorial-press style:
 * Fraunces italic for the name, a hairline rule below, a small Instrument Sans
 * tagline — reads as a publication masthead rather than an app toolbar.
 */
export default function Shell({ right, children }: { right?: ReactNode; children: ReactNode }) {
  return (
    <div className="h-full flex-1 min-w-0 flex flex-col bg-paper paper-tex">
      {/* ── Masthead ── */}
      <header className="relative px-6 pt-5 pb-3">
        <div className="flex items-end justify-between gap-6">
          <div className="flex items-baseline gap-4">
            <h1 className="font-display text-display-sm text-ink italic leading-none">
              Data-<span className="not-italic font-[500]">Chat</span>
            </h1>
            <span className="hidden sm:inline font-body text-label-sm uppercase text-ink-3">
              a database conversation
            </span>
          </div>
          <div className="flex items-center gap-3">{right}</div>
        </div>
        {/* double rule — characteristically editorial */}
        <div className="absolute left-6 right-6 bottom-1.5 hairline-strong h-px" />
        <div className="absolute left-6 right-6 -bottom-0 hairline h-px" />
      </header>

      {/* ── Main ── */}
      <main className="flex-1 min-h-0 relative">{children}</main>
    </div>
  );
}
