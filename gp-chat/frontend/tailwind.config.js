export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface:  { 900: '#0b1020', 800: '#11172b', 700: '#1a2340' },
        accent:   { blue: '#3d7dff', green: '#2ecc71', purple: '#8a5cf6', amber: '#f59e0b', red: '#ef4444' }
      }
    }
  },
  plugins: []
};
