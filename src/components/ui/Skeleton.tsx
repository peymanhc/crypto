// Loading placeholder blocks that shimmer in place of a card's content
const Skeleton: React.FC<{ lines?: number; className?: string }> = ({ lines = 4, className = '' }) => (
  <div className={`space-y-2.5 ${className}`} aria-hidden>
    {Array.from({ length: lines }, (_, i) => (
      <div key={i} className="skeleton h-3.5" style={{ width: `${88 - ((i * 23) % 40)}%` }} />
    ))}
  </div>
);

export default Skeleton;
