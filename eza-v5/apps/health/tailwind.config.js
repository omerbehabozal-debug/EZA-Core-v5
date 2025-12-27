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
        health: {
          primary: '#065f46',
          secondary: '#059669',
          accent: '#10b981',
          background: '#f0fdf4',
          surface: '#ffffff',
          border: '#d1fae5',
        },
      },
    },
  },
  plugins: [],
}

