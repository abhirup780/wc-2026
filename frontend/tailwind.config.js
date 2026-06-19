/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // The gray ramp is driven by CSS variables (see index.css) so the whole
        // app flips between dark and light themes without per-class `dark:`
        // variants. Channels are space-separated RGB so Tailwind's /opacity
        // modifiers (e.g. bg-gray-900/80) keep working.
        gray: {
          50:  'rgb(var(--gray-50) / <alpha-value>)',
          100: 'rgb(var(--gray-100) / <alpha-value>)',
          200: 'rgb(var(--gray-200) / <alpha-value>)',
          300: 'rgb(var(--gray-300) / <alpha-value>)',
          400: 'rgb(var(--gray-400) / <alpha-value>)',
          500: 'rgb(var(--gray-500) / <alpha-value>)',
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
          800: 'rgb(var(--gray-800) / <alpha-value>)',
          900: 'rgb(var(--gray-900) / <alpha-value>)',
          950: 'rgb(var(--gray-950) / <alpha-value>)',
        },
        fifa: {
          navy: '#0a1f44',
          blue: '#1d6fe0',
          gold: '#d4af37',
          red: '#ce1126',
        },
      },
    },
  },
  plugins: [],
};
