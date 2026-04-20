/**
 * Status-colored card, light-mode edition.
 *
 * Each variant is a tint + rule pair: a very soft tinted background (so the
 * card reads as "paper with a colored mark on it", never an adverb), a solid
 * left rule in the accent, and a small italic Fraunces title on a tinted
 * header bar. Same information hierarchy as before, without the glow/gradient
 * baggage from the dark theme.
 */
const PALETTES: Record<string, { bg: string; accent: string; headerBg: string; headerText: string }> = {
  blue:   { bg: 'rgba(30,58,138,0.06)',  accent: '#1e3a8a', headerBg: 'rgba(30,58,138,0.12)',  headerText: '#142659' },
  green:  { bg: 'rgba(31,74,50,0.06)',   accent: '#1f4a32', headerBg: 'rgba(31,74,50,0.12)',   headerText: '#123822' },
  red:    { bg: 'rgba(184,58,38,0.06)',  accent: '#b83a26', headerBg: 'rgba(184,58,38,0.12)',  headerText: '#7f2716' },
  purple: { bg: 'rgba(91,43,122,0.06)',  accent: '#5b2b7a', headerBg: 'rgba(91,43,122,0.12)',  headerText: '#3f1d55' },
  amber:  { bg: 'rgba(158,106,21,0.06)', accent: '#9e6a15', headerBg: 'rgba(158,106,21,0.12)', headerText: '#6b4708' },
  teal:   { bg: 'rgba(29,85,82,0.06)',   accent: '#1d5552', headerBg: 'rgba(29,85,82,0.12)',   headerText: '#113c3a' },
};

const ALIAS: Record<string, string> = {
  error: 'red', failed: 'red', failure: 'red', danger: 'red',
  success: 'green', ok: 'green',
  warning: 'amber', warn: 'amber',
  info: 'blue', default: 'blue',
};

function getPalette(color?: string) {
  if (!color) return PALETTES.blue;
  const key = ALIAS[color.toLowerCase()] ?? color.toLowerCase();
  return PALETTES[key] ?? PALETTES.blue;
}

export default function RichCard({ title, color, children }: { title?: string; color?: string; children: React.ReactNode }) {
  const p = getPalette(color);
  return (
    <div
      style={{
        background: p.bg,
        borderLeft: `3px solid ${p.accent}`,
        padding: '14px 18px',
        margin: '16px 0',
      }}
    >
      {title && (
        <div
          style={{
            display: 'inline-block',
            background: p.headerBg,
            color: p.headerText,
            padding: '4px 10px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            marginBottom: '10px',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ color: '#141311', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
