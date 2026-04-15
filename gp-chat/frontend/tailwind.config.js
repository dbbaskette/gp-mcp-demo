export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink:     { 950: '#06080d', 900: '#0a0e18', 800: '#0f1524', 700: '#161e33', 600: '#1e2844' },
        gold:    { 500: '#d4a853', 400: '#e0bd6e', 300: '#ecd48f', 200: '#f5e6b8' },
        gp:      { green: '#2ecc71', emerald: '#1a9b52', dark: '#0d5c2e' },
        signal:  { red: '#e74c3c', amber: '#f39c12', cyan: '#00d4ff', white: '#e8e4dd' },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body:    ['"Outfit"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      animation: {
        'scan':       'scan 4s linear infinite',
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'typing':     'typing 1.2s ease-in-out infinite',
      },
      keyframes: {
        scan:      { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '0 100%' } },
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideLeft: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 8px rgba(212,168,83,0.2)' }, '50%': { boxShadow: '0 0 20px rgba(212,168,83,0.4)' } },
        typing:    { '0%, 100%': { opacity: '0.3' }, '50%': { opacity: '1' } },
      },
      backgroundImage: {
        'grid-fine': 'linear-gradient(rgba(212,168,83,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-fine': '24px 24px',
      },
    }
  },
  plugins: []
};
