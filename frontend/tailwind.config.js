/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        surface: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
        cyan: '#00d4ff',
        gold: '#f5a623',
      },
    },
  },
  plugins: [],
}
