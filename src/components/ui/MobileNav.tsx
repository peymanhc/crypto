import { motion } from 'framer-motion';
import { Route, routeHref } from '../../hooks/useHashRoute';
import { NAV_LINKS } from './navigation';
import { useI18n } from '../../i18n';

// Thumb-reachable tab bar on phones; hidden on wider screens where the header nav shows
const MobileNav: React.FC<{ route: Route }> = ({ route }) => {
  const { t } = useI18n();
  return (
  <nav
    className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-ink-950/80 backdrop-blur-xl sm:hidden"
    style={{ paddingBottom: 'var(--sab)' }}
  >
    <div className="grid grid-cols-4">
      {NAV_LINKS.map((link) => {
        const active = link.route === route;
        return (
          <a
            key={link.route}
            href={routeHref(link.route)}
            className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
              active ? 'text-glow-cyan' : 'text-slate-500'
            }`}
          >
            {active && <motion.span layoutId="mobile-nav-bar" className="absolute top-0 h-0.5 w-10 rounded-full bg-glow-cyan" />}
            {link.icon}
            {t(link.labelKey)}
          </a>
        );
      })}
    </div>
  </nav>
  );
};

export default MobileNav;
