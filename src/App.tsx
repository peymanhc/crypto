import { AnimatePresence, motion } from 'framer-motion';
import { useHashRoute } from './hooks/useHashRoute';
import { useI18n } from './i18n';
import Background from './components/ui/Background';
import Header from './components/ui/Header';
import MobileNav from './components/ui/MobileNav';
import Dashboard from './pages/Dashboard';
import BacktestPage from './pages/BacktestPage';
import StrategiesPage from './pages/StrategiesPage';
import BuilderPage from './pages/BuilderPage';

// App shell: background, header, the current page (with a crossfade), footer, mobile tab bar
function App() {
  const route = useHashRoute();
  const { t } = useI18n();
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
            {route === 'strategies' && <StrategiesPage />}
            {route === 'builder' && <BuilderPage />}
            {route === 'dashboard' && <Dashboard />}
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
