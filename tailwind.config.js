/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CGP Brand Colors
        cgp: {
          red: '#C41E3A',
          'red-dark': '#9A1830',
          'red-light': '#E8345A',
        },
        // Neutral grays for light theme
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Legacy color mappings for compatibility
        navy: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        coral: {
          400: '#E8345A',
          500: '#C41E3A',
          600: '#9A1830',
        },
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'filter-pulse': 'filter-pulse 2s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'highlight-fade': 'highlight-fade 3s ease-out forwards',
      },
      keyframes: {
        'filter-pulse': {
          '0%, 100%': {
            'box-shadow': '0 0 0 0 rgba(196, 30, 58, 0.4)',
          },
          '50%': {
            'box-shadow': '0 0 0 8px rgba(196, 30, 58, 0)',
          },
        },
        'bounce-subtle': {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-2px)',
          },
        },
        'highlight-fade': {
          '0%': {
            'background-color': 'rgb(254 243 199)', // amber-100
            'box-shadow': '0 0 0 2px rgb(252 211 77) inset', // amber-300
          },
          '70%': {
            'background-color': 'rgb(254 243 199)', // keep highlight visible
            'box-shadow': '0 0 0 2px rgb(252 211 77) inset',
          },
          '100%': {
            'background-color': 'transparent',
            'box-shadow': '0 0 0 0 transparent',
          },
        },
      },
    },
  },
  plugins: [],
}
