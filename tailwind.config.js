/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: {
          950: '#05070d',
          900: '#0a0e17',
          800: '#111827',
          700: '#1a2233',
          600: '#26304a',
        },
        long: { DEFAULT: '#34d399', soft: '#10b981' },
        short: { DEFAULT: '#fb7185', soft: '#f43f5e' },
        glow: { cyan: '#22d3ee', violet: '#a78bfa', blue: '#60a5fa', amber: '#fbbf24' },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px -20px rgba(34,211,238,0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -30px rgba(0,0,0,0.8)',
        lift: '0 30px 80px -30px rgba(96,165,250,0.35)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: { '0%, 100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(0,-14px,0)' } },
        drift: {
          '0%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%,-4%,0) scale(1.08)' },
          '66%': { transform: 'translate3d(-5%,5%,0) scale(0.96)' },
          '100%': { transform: 'translate3d(0,0,0) scale(1)' },
        },
        ping: { '0%': { transform: 'scale(1)', opacity: '0.9' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
        gridMove: { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '0 48px' } },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        float: 'float 7s ease-in-out infinite',
        drift: 'drift 26s ease-in-out infinite',
        'drift-slow': 'drift 40s ease-in-out infinite reverse',
        'ping-soft': 'ping 1.8s cubic-bezier(0,0,0.2,1) infinite',
        'spin-slow': 'spinSlow 14s linear infinite',
        grid: 'gridMove 6s linear infinite',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
