import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1F6FEB",
          hover: "#388BFD",
        },
        success: "#2DA44E",
        warning: "#D29922",
        danger: "#CF222E",
        surface: {
          light: "#F6F8FA",
          dark: "#0D1117",
          cardLight: "#FFFFFF",
          cardDark: "#161B22",
        },
      },
      fontFamily: {
        display: ["Georgia", "Songti SC", "STSong", "serif"],
        sans: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        btn: "20px",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(0, 0, 0, 0.04)",
        "soft-dark": "0 4px 24px rgba(0, 0, 0, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
