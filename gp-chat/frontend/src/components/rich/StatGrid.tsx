import React from 'react';

const PALETTES = [
  { bg: 'linear-gradient(135deg,#1e3a5f,#0f2540)', text: '#e8f4fd', glow: 'rgba(30,100,200,0.4)', accent: '#4da6ff' },
  { bg: 'linear-gradient(135deg,#1a3d2b,#0d2218)', text: '#d4edda', glow: 'rgba(40,180,80,0.35)', accent: '#48bb78' },
  { bg: 'linear-gradient(135deg,#3b1f5f,#22103a)', text: '#e8d4fd', glow: 'rgba(130,60,220,0.4)', accent: '#b794f4' },
  { bg: 'linear-gradient(135deg,#1a3d3d,#0d2222)', text: '#d4eded', glow: 'rgba(30,180,180,0.35)', accent: '#4fd1c5' },
  { bg: 'linear-gradient(135deg,#5f4a1e,#3a2c0d)', text: '#fdf3d4', glow: 'rgba(220,160,30,0.35)', accent: '#f6ad55' },
  { bg: 'linear-gradient(135deg,#5f1e1e,#3a0d0d)', text: '#fde8e8', glow: 'rgba(220,50,50,0.35)', accent: '#fc8181' },
  { bg: 'linear-gradient(135deg,#5f1e45,#3a0d28)', text: '#fde8f3', glow: 'rgba(220,50,130,0.4)', accent: '#f687b3' },
  { bg: 'linear-gradient(135deg,#2d3748,#1a2030)', text: '#e2e8f0', glow: 'rgba(100,120,160,0.3)', accent: '#90cdf4' },
];

export function StatGrid({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '12px 0' }}>
      {items.map((child, i) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ colorIndex?: number }>, { colorIndex: i })
          : child
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
    <div style={{
      background: p.bg,
      color: p.text,
      padding: '18px 22px',
      borderRadius: '10px',
      minWidth: '140px',
      flex: '1',
      boxShadow: `0 4px 20px ${p.glow}`,
      borderLeft: `4px solid ${p.accent}`,
    }}>
      <div style={{ fontSize: '11px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '4px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
