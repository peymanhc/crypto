import { motion } from 'framer-motion';
import { Route, routeHref } from '../../hooks/useHashRoute';
import { linksFor } from './navigation';
import { useI18n } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';

// Desktop page switcher with a sliding highlight behind the active page
const NavLinks: React.FC<{ route: Route }> = ({ route }) => {
  const { t } = useI18n();
  const { role } = useAuth();
  return (
  <nav className="hidden items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 sm:flex">
    {linksFor(role === 'admin').map((link) => {
      const active = link.route === route;
      return (
        <a
          key={link.route}
          href={routeHref(link.route)}
          className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {active && (
            <motion.span
              layoutId="nav-pill"
              className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-white/10"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            {link.icon}
            {t(link.labelKey)}
          </span>
        </a>
      );
    })}
  </nav>
  );
};

export default NavLinks;
