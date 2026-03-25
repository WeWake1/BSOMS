import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ['class', 'class'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "390px",
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'sans-serif'],
      },
      fontSize: {
        // Fluid type scale using clamp() — L1 fix
        'fluid-xs':   ['clamp(0.75rem,  1.5vw, 0.875rem)', { lineHeight: '1.4' }],
        'fluid-sm':   ['clamp(0.875rem, 2vw,   1rem)',      { lineHeight: '1.5' }],
        'fluid-base': ['clamp(1rem,     2.5vw, 1.125rem)',  { lineHeight: '1.6' }],
        'fluid-lg':   ['clamp(1.125rem, 3vw,   1.5rem)',    { lineHeight: '1.4' }],
        'fluid-xl':   ['clamp(1.25rem,  3.5vw, 1.875rem)',  { lineHeight: '1.3' }],
        'fluid-2xl':  ['clamp(1.5rem,   4vw,   2.25rem)',   { lineHeight: '1.2' }],
      },
      colors: {
        // All tokens use CSS variables (OKLCH values defined in globals.css)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        // Status colors are OKLCH CSS variables in globals.css.
        // Use arbitrary syntax in components: [background-color:var(--status-pending-bg)]
        // or use getStatusColor() / getStatusCardColor() from lib/utils.ts
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
