import { routeHref } from '../../hooks/useHashRoute';

// The app mark, drawn inline so it never flashes as a broken image
const LogoMark = () => (
  <svg viewBox="0 0 512 512" className="h-9 w-9" aria-hidden>
    <defs>
      <linearGradient id="logo-accent" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#22d3ee" />
        <stop offset="1" stopColor="#a78bfa" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="112" fill="#0b1220" />
    <g fill="url(#logo-accent)">
      <rect x="124" y="236" width="52" height="88" rx="12" />
      <rect x="230" y="186" width="52" height="96" rx="12" />
      <rect x="336" y="146" width="52" height="92" rx="12" />
    </g>
    <path d="M96 372 C 170 340, 210 300, 256 250 S 350 150, 428 118" fill="none" stroke="#ffffff" strokeWidth="22" strokeLinecap="round" />
    <circle cx="428" cy="118" r="26" fill="#ffffff" />
  </svg>
);

const Logo = () => (
  <a href={routeHref('dashboard')} className="flex items-center gap-2.5">
    <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)] ring-1 ring-white/10">
      <LogoMark />
    </span>
    <span className="font-display text-[17px] font-semibold tracking-tight text-white">
      Coin<span className="gradient-text">Analysis</span>
    </span>
  </a>
);

export default Logo;
