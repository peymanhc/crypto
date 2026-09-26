import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHashRoute } from './hooks/useHashRoute';
import { useI18n } from './i18n';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import Background from './components/ui/Background';
import Header from './components/ui/Header';
import MobileNav from './components/ui/MobileNav';
import Dashboard from './pages/Dashboard';
import BacktestPage from './pages/BacktestPage';
import Skeleton from './components/ui/Skeleton';

// The Hyperliquid SDK and wallet libraries are only downloaded when this tab opens
const TradePage = lazy(() => import('./pages/TradePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// App shell: background, header, the current page (with a crossfade), footer, mobile tab bar
function App() {
  const route = useHashRoute();
  const { t } = useI18n();
  const auth = useAuth();

  // Nothing renders until the stored login has been checked with the Worker
  if (!auth.ready) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center">
        <Background />
        <div className="glass w-full max-w-sm p-6"><Skeleton lines={4} /></div>
      </div>
    );
  }
  if (!auth.role) {
    return (
      <>
        <Background />
        <LoginPage />
      </>
    );
  }
  const isAdmin = auth.role === 'admin';

  return (
    <div className="relative flex min-h-[100svh] flex-col">
      <Background />
      <Header route={route} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-4 sm:pb-8 sm:pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {route === 'backtest' && <BacktestPage />}
            {route === 'trade' && (
              <Suspense fallback={<div className="glass p-6"><Skeleton lines={6} /></div>}>
                <TradePage />
              </Suspense>
            )}
            {route === 'admin' && isAdmin && (
              <Suspense fallback={<div className="glass p-6"><Skeleton lines={6} /></div>}>
                <AdminPage />
              </Suspense>
            )}
            {(route === 'dashboard' || (route === 'admin' && !isAdmin)) && <Dashboard />}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="hidden pb-6 text-center text-xs text-slate-500 sm:block">
        {t('footer.contact')} — <span className="font-semibold text-slate-300">Peymanhc@gmail.com</span>
      </footer>
      <MobileNav route={route} />
    </div>
  );
}

export default App;
