/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ibm-blue': '#0F62FE',
        'ibm-green': '#24A148',
        'ibm-red': '#DA1E28',
        'ibm-gray': '#8D8D8D',
        'ibm-bg': '#F4F4F4',
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: '0.5',
            transform: 'scale(1.1)',
          },
        },
      },
    },
  },
  plugins: [],
}

// Made with Bob
