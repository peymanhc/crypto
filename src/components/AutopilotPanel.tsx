import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AutopilotStatus, AutopilotTrade, AutopilotScanResult, RiskLevel } from '../types/trading';
import { TIMEFRAMES } from '../constants/trading';
import {
  fetchTradingPairs,
  saveAutopilot,
  fetchAutopilotStatus,
  resetAutopilot,
  scanAutopilotNow,
  closeAutopilotTrade,
  isAutoCloseAvailable,
  isTelegramConfigured,
  TELEGRAM_BOT_USERNAME,
} from '../services/api';
import { Bot, X, RefreshCw, RotateCcw, Radar } from 'lucide-react';
import CoinSearchInput from './ui/CoinSearchInput';
import { loadWindows, localTzOffsetMinutes } from '../lib/tradeWindows';
import Card from './ui/Card';
import { useI18n } from '../i18n';

const MAX_COINS = 4;
const RISK_LEVELS: RiskLevel[] = ['Low', 'Medium', 'High'];
const riskCheckboxColor: Record<RiskLevel, string> = {
  Low: 'text-long',
  Medium: 'text-glow-amber',
  High: 'text-short',
};
const MAX_SUGGESTIONS = 30;
const STATUS_REFRESH_MS = 30_000;

const formatPrice = (value: number): string =>
  value >= 1000 ? value.toFixed(2) : Number(value.toPrecision(5)).toString();

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const readStorage = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable — the panel still works for this session
  }
};

interface TradeRowProps {
  trade: AutopilotTrade;
  onClose?: (trade: AutopilotTrade) => void;
  closing?: boolean;
}

const TradeRow: React.FC<TradeRowProps> = ({ trade, onClose, closing }) => {
  const { t } = useI18n();
  const dirColor = trade.direction === 'Long' ? 'text-long' : 'text-short';
  const closed = trade.closedAt !== undefined;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[11px]"
    >
      <span className="font-mono">
        <span className={`font-bold ${dirColor}`}>${trade.base} {trade.direction.toUpperCase()}</span>
        {trade.venue === 'hyperliquid' && <span className="ms-1 rounded border border-glow-violet/40 px-1 text-[9px] text-glow-violet">HL</span>}{' '}
        <span className="text-slate-500">@ {formatPrice(trade.entry)} · {trade.leverage}x</span>
      </span>
      {closed ? (
        <span className={`font-medium ${(trade.pnlPct ?? 0) >= 0 ? 'text-long' : 'text-short'}`}>
          {trade.pnlPct === undefined ? '—' : `${trade.pnlPct >= 0 ? '+' : ''}${trade.pnlPct.toFixed(2)}%`}
          <span className="font-normal text-slate-500"> · {formatTime(trade.closedAt!)}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          {trade.takeProfits && (
            <span className="text-slate-500" title={t('auto.tpHint')}>
              TP {trade.tpHit ?? 0}/{trade.takeProfits.length}
            </span>
          )}
          <span className="text-slate-500">{t('common.since', { time: formatTime(trade.openedAt) })}</span>
          {onClose && (
            <button
              type="button"
              onClick={() => onClose(trade)}
              disabled={closing}
              title={t('auto.closeTradeTitle')}
              className="btn-danger !rounded-md !px-1.5 !py-0.5 text-[10px]"
            >
              {closing ? '...' : t('auto.closeTrade')}
            </button>
          )}
        </span>
      )}
    </motion.div>
  );
};

const scanOutcomeLabel = (result: AutopilotScanResult, t: ReturnType<typeof useI18n>['t']): string => {
  switch (result.status) {
    case 'posted':
      return t('auto.status.posted');
    case 'open':
      return t('auto.status.open');
    case 'cooldown':
      return t('auto.status.cooldown');
    case 'paused':
      return t('auto.status.paused');
    case 'error':
      return t('auto.status.error', { error: result.error ?? 'unknown' });
    default:
      return t('auto.status.noSignal');
  }
};

// One line per coin: what the Worker saw on its latest scan and what it did about it
const ScanRow: React.FC<{ result: AutopilotScanResult }> = ({ result }) => {
  const { t } = useI18n();
  const dirColor =
    result.direction === 'Long' ? 'text-long' : result.direction === 'Short' ? 'text-short' : 'text-slate-500';
  const outcomeColor =
    result.status === 'posted' ? 'text-long' : result.status === 'error' ? 'text-short' : 'text-slate-500';
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[11px]">
      <span className="font-mono">
        <span className="text-slate-200">{result.coin}</span>{' '}
        {result.direction && (
          <span className={dirColor}>
            {result.direction.toUpperCase()} · {t(`common.level.${result.riskLevel ?? 'Low'}`)}
          </span>
        )}
      </span>
      <span className={`${outcomeColor} max-w-[55%] truncate`} title={result.error}>
        {scanOutcomeLabel(result, t)}
      </span>
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</p>
);

// Server-side autopilot: the Worker scans the chosen coins on its own timer, posts
// Low-risk signals to the channel and closes them at the profit target
const AutopilotPanel: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [channel, setChannel] = useState(() => readStorage('telegram-channel', ''));
  const [coins, setCoins] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(readStorage('autopilot-coins', '[]'));
      return Array.isArray(stored) ? stored.filter((c) => typeof c === 'string').slice(0, MAX_COINS) : [];
    } catch {
      return [];
    }
  });
  const [coinInput, setCoinInput] = useState('');
  const [pairs, setPairs] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState(() => readStorage('autopilot-timeframe', '15m'));
  const [targetPct, setTargetPct] = useState(() => readStorage('telegram-profit-target', '2'));
  const [hlPumpShort, setHlPumpShort] = useState(() => readStorage('autopilot-hl-pump-short', 'false') === 'true');
  const [hlPumpPct, setHlPumpPct] = useState(() => readStorage('autopilot-hl-pump-pct', '150'));
  const [riskLevels, setRiskLevels] = useState<RiskLevel[]>(() => {
    try {
      const stored = JSON.parse(readStorage('autopilot-risk-levels', '["Low"]'));
      const valid = Array.isArray(stored) ? RISK_LEVELS.filter((r) => stored.includes(r)) : [];
      return valid.length ? valid : ['Low'];
    } catch {
      return ['Low'];
    }
  });
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const { t, ttf, tm } = useI18n();

  useEffect(() => {
    let cancelled = false;
    fetchTradingPairs()
      .then((all) => {
        if (!cancelled) setPairs(all);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The Worker is the source of truth: hydrate the form from the saved config
  const loadStatus = async (hydrate: boolean) => {
    if (!channel.trim()) return;
    setRefreshing(true);
    try {
      const next = await fetchAutopilotStatus(channel);
      setStatus(next);
      if (hydrate && next.config) {
        setEnabled(next.config.enabled);
        setCoins(next.config.coins);
        setTimeframe(next.config.timeframe);
        setTargetPct(String(next.config.targetPct));
        setRiskLevels(next.config.riskLevels?.length ? next.config.riskLevels : ['Low']);
        setHlPumpShort(next.config.hlPumpShort === true);
        setHlPumpPct(String(next.config.hlPumpPct ?? 150));
        setDirty(false);
      }
      setError(null);
    } catch {
      setError('Could not reach the autopilot worker.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => loadStatus(false), STATUS_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channel]);

  const query = coinInput.trim().toUpperCase();
  const suggestions = query
    ? pairs.filter((p) => p.startsWith(query) && !coins.includes(p)).slice(0, MAX_SUGGESTIONS)
    : [];

  const addCoin = (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value || coins.length >= MAX_COINS) return;
    // "BTCUSDT" -> "BTC/USDT"
    const pair = value.includes('/') ? value : value.replace(/^(.+?)(USDT|USDC|FDUSD|TUSD|BUSD)$/, '$1/$2');
    if (!/^[A-Z0-9]{2,15}\/[A-Z0-9]{2,10}$/.test(pair) || coins.includes(pair)) return;
    const next = [...coins, pair];
    setCoins(next);
    writeStorage('autopilot-coins', JSON.stringify(next));
    setCoinInput('');
    setDirty(true);
  };

  const removeCoin = (pair: string) => {
    const next = coins.filter((c) => c !== pair);
    setCoins(next);
    writeStorage('autopilot-coins', JSON.stringify(next));
    setDirty(true);
  };

  const save = async (nextEnabled: boolean) => {
    // Turning off must always work, even if the coin list was cleared in the form
    const coinsToSend = coins.length > 0 ? coins : status?.config?.coins ?? [];
    if (!channel.trim() || coinsToSend.length === 0) {
      setError(coinsToSend.length === 0 ? 'Pick at least one coin.' : 'Enter your Telegram channel.');
      return;
    }
    if (riskLevels.length === 0) {
      setError('Pick at least one risk level.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await saveAutopilot({
        enabled: nextEnabled,
        channel: channel.trim(),
        coins: coinsToSend,
        timeframe,
        targetPct: Math.min(100, Math.max(0.1, Number(targetPct) || 2)),
        riskLevels,
        hlPumpShort,
        hlPumpPct: Math.min(1000, Math.max(10, Number(hlPumpPct) || 150)),
        // No-trade windows come from the Dashboard card next to this panel
        noTradeWindows: loadWindows(),
        tzOffsetMinutes: localTzOffsetMinutes(),
      });
      setStatus(next);
      setEnabled(nextEnabled);
      setDirty(false);
      writeStorage('telegram-channel', channel.trim());
      writeStorage('autopilot-timeframe', timeframe);
      writeStorage('telegram-profit-target', targetPct);
      writeStorage('autopilot-risk-levels', JSON.stringify(riskLevels));
      writeStorage('autopilot-hl-pump-short', String(hlPumpShort));
      writeStorage('autopilot-hl-pump-pct', hlPumpPct);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving failed');
    } finally {
      setSaving(false);
    }
  };

  const [resetting, setResetting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [closingKey, setClosingKey] = useState<string | null>(null);

  const handleScanNow = async () => {
    setScanning(true);
    setError(null);
    try {
      setStatus(await scanAutopilotNow(channel.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleCloseTrade = async (trade: AutopilotTrade) => {
    if (!window.confirm(`Post CLOSE $${trade.base} to the channel and close this trade?`)) return;
    const key = `${trade.symbol}-${trade.openedAt}`;
    setClosingKey(key);
    setError(null);
    try {
      setStatus(await closeAutopilotTrade(channel.trim(), trade.symbol, trade.openedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Close failed');
    } finally {
      setClosingKey(null);
    }
  };
  const handleReset = async () => {
    const openCount = status?.openTrades.length ?? 0;
    const message = openCount
      ? `Close ${openCount} open trade${openCount === 1 ? '' : 's'} in the channel (CLOSE + result reply) and start over?`
      : 'Clear the autopilot history and start over?';
    if (!window.confirm(message)) return;
    setResetting(true);
    setError(null);
    try {
      setStatus(await resetAutopilot(channel.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const toggleRisk = (level: RiskLevel, checked: boolean) => {
    const next = checked ? RISK_LEVELS.filter((r) => r === level || riskLevels.includes(r)) : riskLevels.filter((r) => r !== level);
    setRiskLevels(next);
    writeStorage('autopilot-risk-levels', JSON.stringify(next));
    setDirty(true);
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      save(true);
    } else if (status?.config) {
      save(false);
    } else {
      setEnabled(false);
    }
  };

  if (!isTelegramConfigured || !isAutoCloseAvailable) return null;

  const openTrades = status?.openTrades ?? [];
  const recentTrades = status?.recentTrades ?? [];

  return (
    <Card
      title={t('auto.title')}
      icon={<Bot className="h-4 w-4" />}
      delay={0.08}
      right={
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <span className={enabled ? 'text-long' : ''}>{enabled ? t('auto.on') : t('auto.off')}</span>
          <span className="relative inline-flex h-6 w-11 items-center">
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={(e) => handleToggle(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-white/10 transition-colors peer-checked:bg-long/70 peer-disabled:opacity-50" />
            <span className="absolute start-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
          </span>
        </label>
      }
    >
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-slate-500">{t('auto.description')}</p>

        <input
          type="text"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setDirty(true);
          }}
          onBlur={() => loadStatus(true)}
          placeholder={t('common.channelPlaceholder')}
          className="field !py-1.5 text-xs"
        />

        <div className="space-y-1.5">
          <AnimatePresence>
            {coins.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {coins.map((pair) => (
                  <motion.span
                    layout
                    key={pair}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="inline-flex items-center gap-1 rounded-lg border border-glow-cyan/30 bg-glow-cyan/10 px-2 py-0.5 font-mono text-[11px] text-glow-cyan"
                  >
                    {pair}
                    <button type="button" onClick={() => removeCoin(pair)} className="text-glow-cyan/60 hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </motion.span>
                ))}
              </div>
            )}
          </AnimatePresence>
          {coins.length < MAX_COINS && (
            <CoinSearchInput
              value={coinInput}
              suggestions={suggestions}
              placeholder={t('auto.addCoin', { count: coins.length, max: MAX_COINS })}
              onChange={setCoinInput}
              onAdd={addCoin}
            />
          )}
        </div>

        <div className="flex gap-2">
          <select
            value={timeframe}
            onChange={(e) => {
              setTimeframe(e.target.value);
              setDirty(true);
            }}
            className="field min-w-0 flex-1 !py-1.5 text-xs"
          >
            {TIMEFRAMES.map(({ value }) => (
              <option key={value} value={value}>{ttf(value)}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-400">
            {t('auto.profitAtLeast')}
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={targetPct}
              onChange={(e) => {
                setTargetPct(e.target.value);
                setDirty(true);
              }}
              className="field !w-16 !px-1.5 !py-1 text-[11px]"
            />
            %
          </label>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>{t('auto.tradeRisk')}</span>
          {RISK_LEVELS.map((level) => (
            <label key={level} className={`flex cursor-pointer items-center gap-1.5 ${riskCheckboxColor[level]}`}>
              <input
                type="checkbox"
                className="checkbox"
                checked={riskLevels.includes(level)}
                onChange={(e) => toggleRisk(level, e.target.checked)}
              />
              {t(`common.level.${level}`)}
            </label>
          ))}
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-glow-violet/20 bg-glow-violet/[0.06] p-2.5 text-[11px] text-slate-400">
          <input
            type="checkbox"
            className="checkbox mt-0.5"
            checked={hlPumpShort}
            onChange={(e) => {
              setHlPumpShort(e.target.checked);
              writeStorage('autopilot-hl-pump-short', String(e.target.checked));
              setDirty(true);
            }}
          />
          <span className="leading-relaxed">
            <span className="font-semibold text-glow-violet">{t('auto.hlTitle')}</span>{t('auto.hlBefore')}{' '}
            <input
              type="number"
              min={10}
              max={1000}
              step={5}
              value={hlPumpPct}
              disabled={!hlPumpShort}
              onChange={(e) => {
                setHlPumpPct(e.target.value);
                writeStorage('autopilot-hl-pump-pct', e.target.value);
                setDirty(true);
              }}
              className="field mx-1 inline-block !w-16 !px-1.5 !py-0.5 align-middle text-[11px]"
            />
            {t('auto.hlAfter')}
          </span>
        </label>

        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving || (!dirty && enabled)}
          className={`w-full ${saving || (!dirty && enabled) ? 'btn-ghost' : 'btn-primary'} !py-2 text-xs`}
        >
          {saving ? t('auto.saving') : enabled ? (dirty ? t('auto.update') : t('auto.running')) : t('auto.start')}
        </button>

        {error && <p className="rounded-lg border border-short/30 bg-short/10 px-2.5 py-1.5 text-[11px] text-short">{tm(error)}</p>}

        {status?.config && (
          <div className="space-y-2 border-t border-white/[0.06] pt-3">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>
                {status.lastScanAt ? t('auto.lastScan', { time: formatTime(status.lastScanAt) }) : t('auto.noScan')}
                {status.lastError && <span className="text-short"> · {status.lastError}</span>}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleScanNow}
                  disabled={scanning || !enabled}
                  title={t('auto.scanTitle')}
                  className="flex items-center gap-1 text-glow-cyan hover:text-white disabled:opacity-50"
                >
                  <Radar className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? t('auto.scanning') : t('auto.scanNow')}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  title={t('auto.resetTitle')}
                  className="flex items-center gap-1 text-short/80 hover:text-short disabled:opacity-50"
                >
                  <RotateCcw className={`h-3 w-3 ${resetting ? 'animate-spin' : ''}`} />
                  {t('auto.reset')}
                </button>
                <button
                  type="button"
                  onClick={() => loadStatus(false)}
                  disabled={refreshing}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-300"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </span>
            </div>
            {status.lastScan && status.lastScan.results.length > 0 && (
              <div className="space-y-1">
                <SectionLabel>{t('auto.lastScanHeader')}</SectionLabel>
                {status.lastScan.results.map((r) => <ScanRow key={r.coin} result={r} />)}
              </div>
            )}
            {status.config.hlPumpShort && (
              <div className="space-y-1">
                <SectionLabel>
                  {t('auto.hlHeader')}
                  {status.lastHlScan
                    ? ` · ${t('auto.hlChecked', { time: formatTime(status.lastHlScan.at), perps: status.lastHlScan.checked })}${
                        status.lastHlScan.spotChecked ? ` ${t('auto.hlSpot', { count: status.lastHlScan.spotChecked })}` : ''
                      }`
                    : ` · ${t('auto.hlNotChecked')}`}
                </SectionLabel>
                {status.lastHlScan?.error && (
                  <p className="text-[11px] text-short">{status.lastHlScan.error}</p>
                )}
                {status.lastHlScan && !status.lastHlScan.error && status.lastHlScan.pumps.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    {t('auto.hlNone', { pct: status.lastHlScan.threshold ?? status.config.hlPumpPct ?? 150 })}
                  </p>
                )}
                {status.lastHlScan?.top && status.lastHlScan.top.length > 0 && (
                  <p className="flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                    <span>{t('auto.top24h')}</span>
                    {status.lastHlScan.top.map((m) => (
                      <span key={`${m.market ?? 'perp'}-${m.coin}`} className="font-mono">
                        {m.coin}
                        {m.market === 'spot' && <span className="text-glow-violet"> {t('auto.spot')}</span>}{' '}
                        <span className={m.changePct >= 0 ? 'text-long' : 'text-short'}>{m.changePct >= 0 ? '+' : ''}{m.changePct.toFixed(1)}%</span>
                      </span>
                    ))}
                  </p>
                )}
                {status.lastHlScan?.pumps.map((p) => (
                  <div key={p.coin} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[11px]">
                    <span className="font-mono">
                      <span className="text-slate-200">{p.coin}</span>{' '}
                      <span className="text-long">+{p.changePct.toFixed(0)}%</span>
                    </span>
                    <span
                      className={p.status === 'posted' ? 'text-long' : p.status === 'error' ? 'text-short' : 'text-slate-500'}
                      title={p.error}
                    >
                      {p.status === 'posted'
                        ? t('auto.hl.posted')
                        : p.status === 'open'
                          ? t('auto.status.open')
                          : p.status === 'spot-no-perp'
                            ? t('auto.hl.spotNoPerp')
                            : p.status === 'error'
                              ? t('auto.status.error', { error: p.error ?? '' })
                              : p.status === 'cooldown'
                                ? t('auto.status.cooldown')
                                : p.status === 'low-volume'
                                  ? t('auto.hl.lowVolume')
                                  : p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {openTrades.length > 0 && (
              <div className="space-y-1">
                <SectionLabel>{t('auto.open')}</SectionLabel>
                <AnimatePresence>
                  {openTrades.map((t) => (
                    <TradeRow
                      key={`${t.symbol}-${t.openedAt}`}
                      trade={t}
                      onClose={handleCloseTrade}
                      closing={closingKey === `${t.symbol}-${t.openedAt}`}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
            {recentTrades.length > 0 && (
              <div className="space-y-1">
                <SectionLabel>{t('auto.closed')}</SectionLabel>
                {recentTrades.slice(0, 5).map((t) => <TradeRow key={`${t.symbol}-${t.openedAt}`} trade={t} />)}
              </div>
            )}
            {openTrades.length === 0 && recentTrades.length === 0 && !status.lastScan && (
              <p className="text-[10px] text-slate-500">{t('auto.waiting', { bot: TELEGRAM_BOT_USERNAME })}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default AutopilotPanel;
