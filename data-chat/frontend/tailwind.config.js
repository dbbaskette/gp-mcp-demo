/**
 * Data-Chat design tokens.
 *
 * Aesthetic: editorial press. Warm cream paper, deep ink body, cobalt as the
 * single action color. No dark mode, no glow, no gold. Typography and hairlines
 * do the work.
 *
 * Token rules (enforced by convention — violate only when an arbitrary value
 * is genuinely exceptional):
 *
 *   opacity steps      : 15 / 30 / 50 / 75 / 90 (override: `opacity-hair`, `opacity-rule`)
 *   spacing steps      : 1 2 3 4 6 8 12 16 (= 4..64px on a 4px grid)
 *   radius             : 0 / 2 / 4 (px). Pills are banned.
 *   shadow             : paper (warm, subtle) or none
 *   type (ui)          : label-xs / label-sm / body / body-lg / display-sm / display / display-lg
 *
 * The palette uses semantic names: paper / ink / cobalt / cinnabar / forest /
 * saffron. Never reference a numeric scale in components — always the token.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // unused; keep for safety so any stray `dark:` utilities no-op
  theme: {
    extend: {
      colors: {
        // ── Surfaces ──
        paper:    { DEFAULT: '#f4eee2', 2: '#ebe3d4', 3: '#ddd2bd' },
        // ── Text ──
        ink:      { DEFAULT: '#141311', 2: '#3a3632', 3: '#6b655c' },
        // ── Accent (primary action, active states, brand) ──
        cobalt:   { DEFAULT: '#1e3a8a', dark: '#142659', soft: '#e6ebf6' },
        // ── Alerts ──
        cinnabar: { DEFAULT: '#b83a26', soft: '#f6e3dd' },
        forest:   { DEFAULT: '#1f4a32', soft: '#e1ece4' },
        saffron:  { DEFAULT: '#9e6a15', soft: '#f1e8d0' },
        plum:     { DEFAULT: '#5b2b7a', soft: '#ece0f0' },
        teal:     { DEFAULT: '#1d5552', soft: '#dcebea' },
      },
      fontFamily: {
        // Fraunces: variable serif, ideal for display; opsz axis enables optical sizing
        display: ['"Fraunces"', 'Georgia', 'serif'],
        // Instrument Sans: humanist-geometric, under-used in product UI, distinct from Inter
        body:    ['"Instrument Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Paired line-heights baked in — ch-based for reading.
        'label-xs':   ['10px', { lineHeight: '1.1',  letterSpacing: '0.14em' }],
        'label-sm':   ['11px', { lineHeight: '1.2',  letterSpacing: '0.10em' }],
        'body':       ['15px', { lineHeight: '1.65' }],
        'body-lg':    ['17px', { lineHeight: '1.65' }],
        'display-sm': ['22px', { lineHeight: '1.2' }],
        'display':    ['32px', { lineHeight: '1.1' }],
        'display-lg': ['56px', { lineHeight: '1.02', letterSpacing: '-0.015em' }],
      },
      spacing: {
        // 4px baseline grid; numeric Tailwind 1..16 stays but we lean on the
        // semantic aliases in components.
        'gutter': '24px',
        'column': '64ch',
      },
      borderRadius: {
        DEFAULT: '2px',
        none: '0',
        sm: '2px',
        md: '4px',
        lg: '4px', // flattened deliberately
        xl: '4px',
      },
      boxShadow: {
        // Warm paper shadow, never blue-black.
        paper:     '0 1px 0 rgba(20,19,17,0.08), 0 8px 24px -12px rgba(20,19,17,0.14)',
        'paper-lg':'0 2px 0 rgba(20,19,17,0.08), 0 24px 48px -20px rgba(20,19,17,0.22)',
      },
      opacity: {
        hair: '0.15',   // whisper rule
        rule: '0.30',   // standard hairline
        strong: '0.60', // emphasized rule
      },
      animation: {
        'fade-in':     'fadeIn 0.4s ease-out both',
        'slide-up':    'slideUp 0.35s cubic-bezier(0.2,0.8,0.2,1) both',
        'slide-left':  'slideLeft 0.3s cubic-bezier(0.2,0.8,0.2,1) both',
        'underline-in':'underlineIn 0.45s cubic-bezier(0.4,0,0.2,1) both',
        'scan':        'scan 2.8s ease-in-out infinite',
        'typing':      'typing 1.3s ease-in-out infinite',
        'pane-split':  'paneSplit 2.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideLeft:    { from: { opacity: '0', transform: 'translateX(14px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        underlineIn:  { from: { transform: 'scaleX(0)', transformOrigin: 'left' }, to: { transform: 'scaleX(1)', transformOrigin: 'left' } },
        scan:         { '0%': { transform: 'translateY(-100%)', opacity: '0' }, '50%': { opacity: '1' }, '100%': { transform: 'translateY(100%)', opacity: '0' } },
        typing:       { '0%, 100%': { opacity: '0.25' }, '50%': { opacity: '1' } },
        paneSplit:    { '0%, 100%': { transform: 'translateX(0)' }, '50%': { transform: 'translateX(4px)' } },
      },
    },
  },
  plugins: [],
};
