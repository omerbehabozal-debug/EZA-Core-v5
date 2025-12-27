/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        finance: {
          primary: '#7c2d12',
          secondary: '#c2410c',
          accent: '#ea580c',
          background: '#fff7ed',
          surface: '#ffffff',
          border: '#fed7aa',
        },
      },
    },
  },
  plugins: [],
}

