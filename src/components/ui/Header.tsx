import { motion } from 'framer-motion';
import { Route } from '../../hooks/useHashRoute';
import Logo from './Logo';
import NavLinks from './NavLinks';
import InstallButton from './InstallButton';
import LiveBadge from './LiveBadge';
import LanguageSwitcher from './LanguageSwitcher';
import AccountButton from './AccountButton';

// Sticky glass header: logo on the left, pages in the middle, install + live status on the right
const Header: React.FC<{ route: Route }> = ({ route }) => (
  <motion.header
    initial={{ y: -24, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl"
    style={{ paddingTop: 'var(--sat)' }}
  >
    <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
      <Logo />
      <NavLinks route={route} />
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <InstallButton />
        <AccountButton />
        <LiveBadge />
      </div>
    </div>
  </motion.header>
);

export default Header;
