module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0d0d0f",
        "bg-light": "#141417",
        panel: "#16181c",
        accent: "#3fff82",
        "accent-soft": "#2abf66",
        "text": "#e5e5e5",
        "text-dim": "#a1a1a1",
        danger: "#ff5555",
        warning: "#ffcc33",
        info: "#33aaff",
      },
      boxShadow: {
        "accent-glow": "0 0 12px rgba(63, 255, 130, 0.67)",
        "blue-glow": "0 0 12px rgba(51, 170, 255, 0.5)",
        "yellow-glow": "0 0 12px rgba(255, 204, 51, 0.5)",
      },
      backdropBlur: {
        glass: "12px",
      },
      animation: {
        "fade-in": "fadeIn 0.12s ease-out",
        "slide-in": "slideIn 0.12s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};

