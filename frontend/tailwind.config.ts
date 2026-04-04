import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        chroma: {
          cyan: "#22d3ee",
          violet: "#a78bfa",
          magenta: "#e879f9",
          surface: "#070a10",
          panel: "rgba(12, 18, 32, 0.55)",
        },
      },
      backgroundImage: {
        "glass-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(168,85,247,0.06) 100%)",
      },
      boxShadow: {
        glass: "0 8px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        neon: "0 0 24px rgba(34, 211, 238, 0.15)",
      },
    },
  },
  plugins: [],
} satisfies Config;
