import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  hover?: boolean;
  delay?: number;
}

// Glass panel with the shared entrance animation. Every section of the app sits in one.
const Card: React.FC<CardProps> = ({ children, className = '', title, icon, right, hover = true, delay = 0 }) => (
  <motion.section
    initial={{ opacity: 0, y: 18, scale: 0.985 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`glass ${hover ? 'glass-hover' : ''} p-4 sm:p-5 ${className}`}
  >
    {(title || right) && (
      <header className="relative mb-3 flex items-center justify-between gap-3">
        {title && (
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight text-white">
            {icon && <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-glow-cyan">{icon}</span>}
            {title}
          </h2>
        )}
        {right && <div className="flex items-center gap-2">{right}</div>}
      </header>
    )}
    <div className="relative">{children}</div>
  </motion.section>
);

export default Card;
