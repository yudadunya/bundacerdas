/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        body: ["'Plus Jakarta Sans'", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#fdf6ee",
          100: "#faebd7",
          200: "#f4d5a8",
          300: "#ecb96c",
          400: "#e49a3a",
          500: "#d97f1e",
          600: "#c06315",
          700: "#9f4b14",
          800: "#813c18",
          900: "#6a3217",
        },
        sage: {
          50:  "#f4f7f2",
          100: "#e5ede1",
          200: "#ccdbc5",
          300: "#a6c09d",
          400: "#789f6d",
          500: "#568050",
          600: "#43663f",
          700: "#365134",
          800: "#2d422c",
          900: "#263726",
        },
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
