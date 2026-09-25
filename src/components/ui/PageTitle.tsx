import { motion } from 'framer-motion';

interface PageTitleProps {
  eyebrow: React.ReactNode;
  eyebrowColor?: string;
  title: React.ReactNode;
  description: string;
}

// Heading block at the top of every page: small label, big title, one-line description
const PageTitle: React.FC<PageTitleProps> = ({ eyebrow, eyebrowColor = 'text-glow-cyan', title, description }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between"
  >
    <div>
      <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${eyebrowColor}`}>{eyebrow}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
    </div>
    <p className="max-w-md text-xs text-slate-500 sm:text-end">{description}</p>
  </motion.div>
);

export default PageTitle;
