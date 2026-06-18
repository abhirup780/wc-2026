/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fifa: {
          navy: '#002868',
          blue: '#004d9f',
          gold: '#c8a951',
          red: '#ce1126',
        },
      },
    },
  },
  plugins: [],
};
