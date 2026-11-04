/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Syne", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          900: "#0b0c10",
          800: "#111218",
          700: "#151720",
          600: "#1c1f29",
          500: "#242836",
          400: "#2f3444",
          300: "#4a5067",
          200: "#6e7280",
          100: "#9aa0b0",
          50:  "#e6e3d9",
        },
        amber: {
          500: "#ffb454",
          600: "#e8982b",
        },
        signal: {
          on:  "#69f07a",
          off: "#c74a3c",
          mid: "#ffb454",
        },
      },
      boxShadow: {
        pit: "inset 0 1px 0 0 rgba(255,255,255,0.04), inset 0 -1px 0 0 rgba(0,0,0,0.35)",
        glow: "0 0 18px 0 rgba(255, 180, 84, 0.45)",
      },
      letterSpacing: {
        widest2: "0.25em",
      },
    },
  },
  plugins: [],
};
