import { motion } from 'framer-motion';
import { LineChart } from 'lucide-react';
import Skeleton from './Skeleton';

interface PlaceholderProps {
  text: string;
  loading?: boolean;
  delay?: number;
}

// Empty card shown before the user runs an analysis; shimmers while loading
const Placeholder: React.FC<PlaceholderProps> = ({ text, loading = false, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    className="glass flex min-h-[160px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-500"
  >
    {loading ? (
      <Skeleton lines={5} className="w-full max-w-xs" />
    ) : (
      <>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.05] text-glow-cyan animate-float">
          <LineChart className="h-5 w-5" />
        </span>
        {text}
      </>
    )}
  </motion.div>
);

export default Placeholder;
