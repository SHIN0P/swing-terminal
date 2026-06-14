/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: '#080C10',
        surface: '#0D1117',
        card: '#161B22',
        hover: '#1C2330',
        dim: '#21293A',
        accent: '#00E5A0',
        textPrimary: '#E6EDF3',
        textSecondary: '#8B949E',
        positive: '#00E5A0',
        negative: '#F85149',
        warning: '#E3B341',
        info: '#58A6FF',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
