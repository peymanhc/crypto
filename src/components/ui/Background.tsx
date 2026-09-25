// Ambient backdrop: slow-drifting colour blobs under a faint moving grid. Purely
// decorative; pointer-events are off so it never intercepts taps.
const Background = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <div className="absolute inset-0 bg-ink-950" />
    <div className="absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full bg-glow-cyan/[0.13] blur-[120px] animate-drift" />
    <div className="absolute -right-[25%] top-[10%] h-[60vmax] w-[60vmax] rounded-full bg-glow-violet/[0.14] blur-[120px] animate-drift-slow" />
    <div className="absolute -bottom-[30%] left-[20%] h-[60vmax] w-[60vmax] rounded-full bg-glow-blue/[0.10] blur-[130px] animate-drift" style={{ animationDelay: '-12s' }} />
    <div
      className="absolute inset-0 bg-grid-fade bg-[size:48px_48px] animate-grid opacity-60"
      style={{ maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%)' }}
    />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(5,7,13,0.6)_70%,#05070d_100%)]" />
  </div>
);

export default Background;
