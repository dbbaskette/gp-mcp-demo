const PALETTES: Record<string, { bg: string; glow: string; accent: string; headerBg: string; headerColor: string }> = {
  blue: {
    bg: 'linear-gradient(135deg,#0f1e3a,#0a1428)',
    glow: 'rgba(30,100,200,0.35)',
    accent: '#4da6ff',
    headerBg: 'linear-gradient(90deg,#1a2a4a,#2d3f6a)',
    headerColor: '#90cdf4',
  },
  green: {
    bg: 'linear-gradient(135deg,#0d2218,#081510)',
    glow: 'rgba(40,180,80,0.3)',
    accent: '#48bb78',
    headerBg: 'linear-gradient(90deg,#1a3d2b,#0d3320)',
    headerColor: '#68d391',
  },
  red: {
    bg: 'linear-gradient(135deg,#3a0d0d,#280808)',
    glow: 'rgba(220,50,50,0.35)',
    accent: '#fc8181',
    headerBg: 'linear-gradient(90deg,#5f1e1e,#3a0d0d)',
    headerColor: '#feb2b2',
  },
  purple: {
    bg: 'linear-gradient(135deg,#22103a,#160a28)',
    glow: 'rgba(130,60,220,0.35)',
    accent: '#b794f4',
    headerBg: 'linear-gradient(90deg,#3b1f5f,#22103a)',
    headerColor: '#d6bcfa',
  },
  amber: {
    bg: 'linear-gradient(135deg,#3a2c0d,#281e08)',
    glow: 'rgba(220,160,30,0.3)',
    accent: '#f6ad55',
    headerBg: 'linear-gradient(90deg,#5f4a1e,#3a2c0d)',
    headerColor: '#fbd38d',
  },
  teal: {
    bg: 'linear-gradient(135deg,#0d2222,#081818)',
    glow: 'rgba(30,180,180,0.3)',
    accent: '#4fd1c5',
    headerBg: 'linear-gradient(90deg,#1a3d3d,#0d2828)',
    headerColor: '#81e6d9',
  },
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
    <div style={{
      background: p.bg,
      borderRadius: '12px',
      borderLeft: `4px solid ${p.accent}`,
      padding: '18px 20px',
      margin: '12px 0',
      boxShadow: `0 4px 24px ${p.glow}`,
    }}>
      {title && (
        <div style={{
          background: p.headerBg,
          color: p.headerColor,
          padding: '8px 14px',
          borderRadius: '6px',
          fontWeight: 800,
          fontSize: '11px',
          textTransform: 'uppercase' as const,
          letterSpacing: '1.2px',
          marginBottom: '14px',
          borderLeft: `3px solid ${p.accent}`,
        }}>{title}</div>
      )}
      <div style={{ color: '#e2e8f0' }}>{children}</div>
    </div>
  );
}
