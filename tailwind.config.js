/** @type {import('tailwindcss').Config} */
export default {
  content: ["./resources/**/*.blade.php", "./resources/js/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#061B33",
        canvas: "#F8FAFC",
        orange: {
          DEFAULT: "#F97316",
          600: "#EA580C",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04)",
      },
    },
  },
  plugins: [],
};
