/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: '#07090D',
        surface:  '#10141C',
        card:     '#0A0E14',
        hover:    'rgba(0,229,160,0.05)',
        dim:      '#1A1F2B',
        accent:   '#00E5A0',
        primary:  '#C8D0DC',
        secondary:'#4B5563',
        muted:    '#2A3040',
        positive: '#00E5A0',
        negative: '#FF455A',
        warning:  '#FFB020',
        info:     '#4D9FFF',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
