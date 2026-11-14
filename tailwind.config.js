/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fg: 'rgb(var(--fg) / <alpha-value>)',
        zinc: {
        50: 'rgb(var(--zinc-50) / <alpha-value>)',
        100: 'rgb(var(--zinc-100) / <alpha-value>)',
        200: 'rgb(var(--zinc-200) / <alpha-value>)',
        300: 'rgb(var(--zinc-300) / <alpha-value>)',
        400: 'rgb(var(--zinc-400) / <alpha-value>)',
        500: 'rgb(var(--zinc-500) / <alpha-value>)',
        600: 'rgb(var(--zinc-600) / <alpha-value>)',
        700: 'rgb(var(--zinc-700) / <alpha-value>)',
        800: 'rgb(var(--zinc-800) / <alpha-value>)',
        900: 'rgb(var(--zinc-900) / <alpha-value>)',
        950: 'rgb(var(--zinc-950) / <alpha-value>)',
        },
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
