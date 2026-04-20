import React from 'react';

/**
 * Stat tiles, editorial light-mode edition.
 *
 * Each tile is a paper card with a ruled top (accent color, 3px), a tiny
 * uppercase mono label, a huge Fraunces-italic number, and an optional
 * subline. Reads like a page of annual-report KPIs rather than dashboard
 * gradients.
 *
 * Palettes cycle through the app's semantic accents — cobalt, forest, plum,
 * teal, saffron, cinnabar — not arbitrary blues.
 */
const PALETTES = [
  { accent: '#1e3a8a' }, // cobalt
  { accent: '#1f4a32' }, // forest
  { accent: '#5b2b7a' }, // plum
  { accent: '#1d5552' }, // teal
  { accent: '#9e6a15' }, // saffron
  { accent: '#b83a26' }, // cinnabar
];

export function StatGrid({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        margin: '16px 0',
      }}
    >
      {items.map((child, i) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ colorIndex?: number }>, { colorIndex: i })
          : child,
      )}
    </div>
  );
}

export function StatTile({
  label, value, sub, colorIndex = 0,
}: {
  label?: string; value?: string; sub?: string; colorIndex?: number;
}) {
  const p = PALETTES[colorIndex % PALETTES.length];
  return (
    <div
      style={{
        background: '#ebe3d4',
        borderTop: `3px solid ${p.accent}`,
        padding: '14px 16px 16px',
        minHeight: '112px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: '#3a3632',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontStyle: 'italic',
          fontSize: '38px',
          fontWeight: 500,
          lineHeight: 1,
          color: p.accent,
          margin: '12px 0 4px',
          fontVariationSettings: '"opsz" 144',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: 'Instrument Sans, sans-serif',
            fontSize: '12px',
            color: '#6b655c',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
