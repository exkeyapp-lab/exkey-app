import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        purple: {
          50: "#F4F0FA",
          100: "#EEE7F7",
          400: "#6B4FB8",
          600: "#4A2D8F",
          900: "#2E1B5C",
        },
        gold: {
          50: "#FDF9EC",
          100: "#FAF0D4",
          400: "#E6C157",
          600: "#D4AF37",
          900: "#8B6914",
        },
      },
      fontFamily: {
        sans: ['"PingFang TC"', '"Microsoft JhengHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
