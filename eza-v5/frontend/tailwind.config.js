/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        eza: {
          surface: '#FFFFFF',
          'surface-muted': '#F8FAFC',
          border: '#E2E8F0',
          'border-strong': '#CBD5E1',
          text: '#0F172A',
          'text-secondary': '#475569',
          'text-muted': '#94A3B8',
          accent: '#4F46E5',
          'accent-muted': '#EEF2FF',
          'accent-hover': '#4338CA',
        },
        /** Kurumsal EZA — Standalone chat only */
        standalone: {
          primary: '#007BFF',
          'primary-hover': '#0069D9',
          muted: '#E7F1FF',
          'muted-strong': '#CFE2FF',
          border: '#D6E8FF',
          text: '#1A1A1A',
          'text-secondary': '#5C6578',
          'text-muted': '#8B95A5',
          surface: '#FFFFFF',
          'surface-muted': '#F5F9FF',
        },
        /** Etkileşim raporu — sıcak gözlem paleti (chat mavisi değil) */
        report: {
          accent: '#0D9488',
          'accent-hover': '#0F766E',
          muted: '#F0FDFA',
          'muted-strong': '#CCFBF1',
          border: '#99F6E4',
          ink: '#134E4A',
          'ink-soft': '#5F8A86',
          surface: '#FAFFFE',
          glow: '#5EEAD4',
        },
      },
      boxShadow: {
        'eza-sm': '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        'eza-md': '0 4px 6px -1px rgb(15 23 42 / 0.06), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
        'eza-lg': '0 10px 15px -3px rgb(15 23 42 / 0.06), 0 4px 6px -4px rgb(15 23 42 / 0.04)',
      },
      screens: {
        'xs': '475px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      animation: {
        'bounce': 'bounce 1.4s infinite',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'island-breathe': 'island-breathe 7s ease-in-out infinite',
        'core-aura': 'core-aura 4.8s ease-in-out infinite',
      },
      keyframes: {
        'island-breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.025)' },
        },
        'core-aura': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.9)' },
          '50%': { opacity: '0.6', transform: 'scale(1.12)' },
        },
        bounce: {
          '0%, 100%': {
            transform: 'translateY(0)',
            opacity: '1',
          },
          '50%': {
            transform: 'translateY(-8px)',
            opacity: '0.7',
          },
        },
        'pulse-dot': {
          '0%, 100%': {
            opacity: '0.4',
            transform: 'scale(0.8)',
          },
          '50%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'slide-up': {
          '0%': {
            transform: 'translateY(100%)',
          },
          '100%': {
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
  plugins: [],
}

