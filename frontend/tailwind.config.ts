import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        muted: '#1a1a1a',
        'muted-foreground': '#a1a1aa',
        border: '#27272a',
        input: '#27272a',
        primary: '#ffffff',
        'primary-foreground': '#000000',
        secondary: '#1a1a1a',
        'secondary-foreground': '#ffffff',
        accent: '#27272a',
        'accent-foreground': '#ffffff',
        card: '#0a0a0a',
        'card-foreground': '#ffffff',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}

export default config
