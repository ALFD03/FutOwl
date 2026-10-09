/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EEF2FB", 100: "#D6E0F5", 200: "#ADC1EB", 300: "#7D9BDB", 400: "#4C70C4",
          500: "#2C4FA3", 600: "#1F3C85", 700: "#172E68", 800: "#0F2152", 900: "#0B1F4D", 950: "#060F2A",
        },
        gold: {
          50: "#FCF8EC", 100: "#F7EDCB", 200: "#EFDA94", 300: "#E6C55C", 400: "#D9AF3A",
          500: "#C9A227", 600: "#A9821C", 700: "#86641A", 800: "#6E511C", 900: "#5D441C",
        },
        crimson: {
          50: "#FEF2F2", 100: "#FEE2E2", 200: "#FECACA", 300: "#FCA5A5", 400: "#F87171",
          500: "#DC2626", 600: "#B91C1C", 700: "#991B1B", 800: "#7F1D1D", 900: "#651717",
        },
        ink: { 900: "#07090F", 800: "#0D1220", 700: "#141B2E", 600: "#1C2540" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Montserrat", "Inter", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,31,77,.04), 0 8px 24px -8px rgba(11,31,77,.12)",
        lift: "0 2px 4px rgba(11,31,77,.06), 0 18px 40px -12px rgba(11,31,77,.25)",
        gold: "0 0 0 1px rgba(201,162,39,.35), 0 10px 30px -10px rgba(201,162,39,.45)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
        "scale-in": { from: { opacity: 0, transform: "scale(.96)" }, to: { opacity: 1, transform: "none" } },
        "pulse-live": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.35 } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
      animation: {
        "fade-in": "fade-in .25s ease-out both",
        "slide-up": "slide-up .35s cubic-bezier(.2,.8,.2,1) both",
        "scale-in": "scale-in .2s cubic-bezier(.2,.8,.2,1) both",
        "pulse-live": "pulse-live 1.4s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
