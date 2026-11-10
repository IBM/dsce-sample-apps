/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ibm: {
          blue: '#0f62fe',
          darkBlue: '#0043ce',
          navy: '#001d6c',
          lightBlue: '#edf5ff',
          gray: '#f4f4f4',
          darkGray: '#161616',
          border: '#e0e0e0',
        },
        box: {
          blue: '#0061d5',
          light: '#e8f2ff',
          dark: '#003b82',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 1px 4px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 12px 24px -6px rgba(0, 0, 0, 0.12), 0 4px 8px -2px rgba(0, 0, 0, 0.06)',
        'modal': '0 20px 40px -8px rgba(0, 0, 0, 0.24), 0 8px 16px -4px rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
}
