/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'split': '900px',
      },
      colors: {
        slate: {
          50: '#FAF6ED',
        },
        cream: {
          50: '#FDFCF7',
          100: '#FAF6ED',
          200: '#F4EFE0',
          300: '#EAE1CC',
          DEFAULT: '#FAF6ED',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#00B749',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          DEFAULT: '#00B749',
        },
        vegoil: {
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
          light: '#FCD34D',
          medium: '#F59E0B',
          dark: '#B45309',
        },
        palmoil: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          light: '#F87171',
          medium: '#EF4444',
          dark: '#7F1D1D',
        }
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card-light': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card-elevated-light': '0 4px 8px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'card-dark': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        'card-elevated-dark': '0 4px 12px -1px rgba(0, 0, 0, 0.6), 0 2px 6px -2px rgba(0, 0, 0, 0.4)',
        'glow-brand': '0 0 15px -3px rgba(0, 183, 73, 0.3)',
        'glow-amber': '0 0 15px -3px rgba(245, 158, 11, 0.35)',
        'glow-rose': '0 0 15px -3px rgba(239, 68, 68, 0.35)',
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Menlo', 'monospace'],
        headline: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        title: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        label: ['"IBM Plex Sans"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        wave: {
          '0%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(-25%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.04)' },
        }
      },
      animation: {
        wave: 'wave 6s cubic-bezier(0.36, 0.45, 0.63, 0.53) infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
