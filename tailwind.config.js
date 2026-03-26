/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#FAFAF7', 100: '#F5F3EE', 200: '#EBE7DE' },
        teal: {
          600: '#1A6B5A', 700: '#155A4B', 800: '#104A3D', 900: '#0B3A2F',
        },
        gold: { 400: '#E5BD5A', 500: '#D4A843', 600: '#B8903A' },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
