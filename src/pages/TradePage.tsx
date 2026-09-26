import { Wallet } from 'lucide-react';
import { TradePlan } from '../types/trading';
import { HlPosition } from '../types/hyperliquid';
import { openFromPlan } from '../lib/hyperliquid/orders';
import { useI18n } from '../i18n';
import { useHlSession } from '../hooks/useHlSession';
import { useHlSettings } from '../hooks/useHlSettings';
import { useHlAccount } from '../hooks/useHlAccount';
import { useHlLog } from '../hooks/useHlLog';
import { useHlHistory } from '../hooks/useHlHistory';
import { useAutoTrader } from '../hooks/useAutoTrader';
import PageTitle from '../components/ui/PageTitle';
import LoginCard from '../components/trade/LoginCard';
import AccountCard from '../components/trade/AccountCard';
import SettingsCard from '../components/trade/SettingsCard';
import AutoTraderCard from '../components/trade/AutoTraderCard';
import ManualTradeCard from '../components/trade/ManualTradeCard';
import TradeLogCard from '../components/trade/TradeLogCard';
import HistoryCard from '../components/trade/HistoryCard';

// Trade tab: log in to Hyperliquid, then the dashboard's signals open and close there
// instead of being posted to Telegram. The analysis itself is untouched.
function TradePage() {
  const { t } = useI18n();
  const { session, busy, error, loginWithWallet, loginWithApiKey, logout } = useHlSession();
  const { settings, update } = useHlSettings();
  const account = useHlAccount(session, settings);
  const log = useHlLog();
  const history = useHlHistory(session);
  // After anything executes, both the positions and the exchange history are re-read
  const refreshAll = () => {
    account.refresh();
    history.refresh();
  };
  const auto = useAutoTrader({ session, settings, log: log.add, onOpened: refreshAll });

  const openSignal = async (symbol: string, plan: TradePlan) => {
    if (!session) throw new Error('no-session');
    try {
      const result = await openFromPlan(session, settings, symbol, plan);
      log.add({ kind: 'open', coin: result.coin, direction: plan.direction, size: result.size, price: result.avgPx, leverage: result.leverage, plan });
      refreshAll();
      return result;
    } catch (err) {
      log.add({ kind: 'error', coin: symbol, message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  };

  const closeSignal = async (position: HlPosition) => {
    try {
      const price = await account.close(position);
      log.add({ kind: 'close', coin: position.coin, direction: position.direction, size: position.size, price });
      history.refresh();
    } catch (err) {
      log.add({ kind: 'error', coin: position.coin, message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow={<><Wallet className="h-3.5 w-3.5" /> {t('hl.eyebrow')}</>}
        eyebrowColor="text-glow-violet"
        title={<>{t('hl.title.a')} <span className="gradient-text">{t('hl.title.b')}</span></>}
        description={t('hl.description')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <LoginCard session={session} busy={busy} error={error} onWallet={loginWithWallet} onApiKey={loginWithApiKey} onLogout={logout} />
          <SettingsCard settings={settings} onChange={update} />
        </div>
        <div className="space-y-4 lg:col-span-8">
          {session && <AccountCard account={account.account} error={account.error} closing={account.closing} onRefresh={account.refresh} onClose={closeSignal} />}
          <AutoTraderCard config={auto.config} loggedIn={session !== null} scanning={auto.scanning} lastScan={auto.lastScan} onChange={auto.update} onToggleRisk={auto.toggleRisk} onScanNow={auto.scanNow} />
        </div>
      </div>

      <ManualTradeCard loggedIn={session !== null} onOpen={openSignal} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {session && <HistoryCard fills={history.fills} orders={history.orders} loaded={history.loaded} error={history.error} cancelling={history.cancelling} onRefresh={history.refresh} onCancel={history.cancel} />}
        <TradeLogCard entries={log.entries} />
      </div>
    </div>
  );
}

export default TradePage;
