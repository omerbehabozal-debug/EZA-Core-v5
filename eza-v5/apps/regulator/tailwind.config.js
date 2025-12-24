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
        regulator: {
          primary: '#1e40af',
          secondary: '#3b82f6',
          accent: '#60a5fa',
          background: '#f8fafc',
          surface: '#ffffff',
          border: '#e2e8f0',
        },
      },
    },
  },
  plugins: [],
}

