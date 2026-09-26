import { LayoutDashboard, FlaskConical, Wallet, ShieldCheck } from 'lucide-react';
import { Route } from '../../hooks/useHashRoute';
import { TranslationKey } from '../../i18n/locales/en';

export interface NavLink {
  route: Route;
  labelKey: TranslationKey;
  icon: React.ReactNode;
  // Shown only to the admin
  adminOnly?: boolean;
}

// The pages shown in the header (desktop) and the tab bar (mobile)
export const NAV_LINKS: NavLink[] = [
  { route: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { route: 'trade', labelKey: 'nav.trade', icon: <Wallet className="h-4 w-4" /> },
  { route: 'backtest', labelKey: 'nav.backtest', icon: <FlaskConical className="h-4 w-4" /> },
  { route: 'admin', labelKey: 'nav.admin', icon: <ShieldCheck className="h-4 w-4" />, adminOnly: true },
];

// The links a given role may see
export const linksFor = (isAdmin: boolean): NavLink[] => NAV_LINKS.filter((link) => !link.adminOnly || isAdmin);
