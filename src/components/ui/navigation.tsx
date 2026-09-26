import { LayoutDashboard, FlaskConical, Wallet } from 'lucide-react';
import { Route } from '../../hooks/useHashRoute';
import { TranslationKey } from '../../i18n/locales/en';

export interface NavLink {
  route: Route;
  labelKey: TranslationKey;
  icon: React.ReactNode;
}

// The pages shown in the header (desktop) and the tab bar (mobile)
export const NAV_LINKS: NavLink[] = [
  { route: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { route: 'trade', labelKey: 'nav.trade', icon: <Wallet className="h-4 w-4" /> },
  { route: 'backtest', labelKey: 'nav.backtest', icon: <FlaskConical className="h-4 w-4" /> },
];
