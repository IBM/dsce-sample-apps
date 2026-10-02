/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: '#0d1015',       // page
          surface: '#141920',  // cards
          raised: '#1a2029',   // nested surfaces, bubbles
          line: '#334050',     // borders
          text: '#e6eaf0',
          muted: '#aab4c3',
          faint: '#7a8596',
        },
        accent: { DEFAULT: '#78a9ff', strong: '#3d7bff', soft: 'rgba(120,169,255,0.13)' },
        ok: { DEFAULT: '#5fd48a', soft: 'rgba(95,212,138,0.13)' },
        bad: { DEFAULT: '#ff7f88', soft: 'rgba(255,127,136,0.13)' },
        warn: { DEFAULT: '#f0c04a', soft: 'rgba(240,192,74,0.14)' },
        violet: { DEFAULT: '#b79cff', soft: 'rgba(183,156,255,0.13)' },
        plum: { DEFAULT: '#a78bfa' },
        apricot: { DEFAULT: '#f6c177' },
        coral: { DEFAULT: '#f28b82' },
        teal: { DEFAULT: '#2ad1c9' },
        electric: { DEFAULT: '#b56cff' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
