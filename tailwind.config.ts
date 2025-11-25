import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "eza-dark": "#1d1d1f",
        "eza-blue": "#0071e3",
        "eza-gray": "#f5f5f7",
        "eza-gold": "#f5f5f7",
        "eza-green": "#30d158",
        "eza-text": "#1d1d1f",
        "eza-text-secondary": "#86868b",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display": ["80px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-md": ["56px", { lineHeight: "1.07", letterSpacing: "-0.02em" }],
        "display-sm": ["48px", { lineHeight: "1.08", letterSpacing: "-0.01em" }],
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
      },
    },
  },
  plugins: [],
};
export default config;
