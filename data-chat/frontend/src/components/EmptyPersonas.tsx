/**
 * "Select Personas" empty state for Compare mode.
 *
 * Animates an illustration of the split-pane outcome so the interaction
 * previews itself — per the design critique, empty states should be product
 * moments, not apologies.
 */
export default function EmptyPersonas({ chosen }: { chosen: number }) {
  return (
    <div className="h-full flex items-center justify-center px-8">
      <div className="max-w-[560px] animate-fade-in text-center">
        {/* ── Animated diagram ── */}
        <figure className="mb-10">
          <div className="inline-grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="relative w-28 h-32 border border-ink/30 bg-paper-2 overflow-hidden"
                style={{ animation: 'fadeIn 0.6s ease-out both', animationDelay: `${120 * i}ms` }}
              >
                {/* header bar */}
                <div className="h-4 border-b border-ink/15 flex items-center px-1.5 gap-1">
                  <span className="w-1 h-1 bg-cobalt rounded-full" />
                  <span className="font-mono text-[8px] uppercase text-ink-3 tracking-[0.15em]">{['viewer', 'analyst', 'dba'][i]}</span>
                </div>
                {/* rows */}
                <div className="p-2 space-y-1.5">
                  {[0.9, 0.7, 0.5, 0.8, 0.35].map((w, j) => (
                    <div
                      key={j}
                      className="h-1 bg-ink/20"
                      style={{
                        width: `${w * 100}%`,
                        animation: 'fadeIn 0.8s ease-out both',
                        animationDelay: `${200 + 120 * i + 80 * j}ms`,
                      }}
                    />
                  ))}
                </div>
                {/* scan line */}
                <div
                  className="absolute left-0 right-0 h-8 pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, transparent, rgba(30,58,138,0.15), transparent)',
                    animation: 'scan 2.8s ease-in-out infinite',
                    animationDelay: `${300 + 500 * i}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        </figure>

        {/* ── Headline ── */}
        <h2 className="font-display text-display italic text-ink mb-3">
          Same&nbsp;question,<br />different&nbsp;answers.
        </h2>

        <p className="font-body text-body text-ink-2 mx-auto max-w-[42ch]">
          Pick two or more personas to see a single prompt run across them in parallel.
          Each pane shows what that identity is allowed to see — row grants, table
          privileges, and denials land side-by-side.
        </p>

        {/* ── Progress chip ── */}
        <div className="mt-8 inline-flex items-center gap-3 font-mono text-label-sm uppercase text-ink-3">
          <span className="hairline-rule w-8 h-px" />
          <span>{chosen} of 2+ selected</span>
          <span className="hairline-rule w-8 h-px" />
        </div>
      </div>
    </div>
  );
}
