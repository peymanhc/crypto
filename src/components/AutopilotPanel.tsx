import React, { useEffect, useState } from 'react';
import { AutopilotStatus, AutopilotTrade, AutopilotScanResult } from '../types/trading';
import { TIMEFRAMES } from '../constants/trading';
import {
  fetchTradingPairs,
  saveAutopilot,
  fetchAutopilotStatus,
  isAutoCloseAvailable,
  isTelegramConfigured,
  TELEGRAM_BOT_USERNAME,
} from '../services/api';
import { Bot, X, RefreshCw } from 'lucide-react';

const MAX_COINS = 4;
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

const TradeRow: React.FC<{ trade: AutopilotTrade }> = ({ trade }) => {
  const dirColor = trade.direction === 'Long' ? 'text-green-600' : 'text-red-600';
  const closed = trade.closedAt !== undefined && trade.pnlPct !== undefined;
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="font-mono">
        <span className={`font-bold ${dirColor}`}>${trade.base} {trade.direction.toUpperCase()}</span>{' '}
        <span className="text-gray-500">@ {formatPrice(trade.entry)} · {trade.leverage}x</span>
      </span>
      {closed ? (
        <span className={`font-medium ${trade.pnlPct! >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {trade.pnlPct! >= 0 ? '+' : ''}{trade.pnlPct!.toFixed(2)}%
          <span className="text-gray-400 font-normal"> · {formatTime(trade.closedAt!)}</span>
        </span>
      ) : (
        <span className="text-gray-400">since {formatTime(trade.openedAt)}</span>
      )}
    </div>
  );
};

const scanOutcomeLabel = (result: AutopilotScanResult): string => {
  switch (result.status) {
    case 'posted':
      return 'posted ✓';
    case 'open':
      return 'trade open';
    case 'cooldown':
      return 'cooldown';
    case 'error':
      return `error: ${result.error ?? 'unknown'}`;
    default:
      return 'no signal';
  }
};

// One line per coin: what the Worker saw on its latest scan and what it did about it
const ScanRow: React.FC<{ result: AutopilotScanResult }> = ({ result }) => {
  const dirColor =
    result.direction === 'Long' ? 'text-green-600' : result.direction === 'Short' ? 'text-red-600' : 'text-gray-500';
  const outcomeColor =
    result.status === 'posted' ? 'text-green-700' : result.status === 'error' ? 'text-red-600' : 'text-gray-400';
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="font-mono">
        <span className="text-gray-700">{result.coin}</span>{' '}
        {result.direction && (
          <span className={dirColor}>
            {result.direction.toUpperCase()} · {result.riskLevel}
          </span>
        )}
      </span>
      <span className={`${outcomeColor} truncate max-w-[55%]`} title={result.error}>
        {scanOutcomeLabel(result)}
      </span>
    </div>
  );
};

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
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

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
    setSaving(true);
    setError(null);
    try {
      const next = await saveAutopilot({
        enabled: nextEnabled,
        channel: channel.trim(),
        coins: coinsToSend,
        timeframe,
        targetPct: Math.min(100, Math.max(0.1, Number(targetPct) || 2)),
      });
      setStatus(next);
      setEnabled(nextEnabled);
      setDirty(false);
      writeStorage('telegram-channel', channel.trim());
      writeStorage('autopilot-timeframe', timeframe);
      writeStorage('telegram-profit-target', targetPct);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving failed');
    } finally {
      setSaving(false);
    }
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
    <div className="bg-white rounded-lg p-4 space-y-2 shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-blue-600" />
          Autopilot
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          {enabled ? 'On' : 'Off'}
        </label>
      </div>
      <p className="text-[10px] text-gray-400">
        Runs server-side: posts every Low-risk signal on the chosen coins to your channel and sends
        CLOSE $COIN once the leveraged profit target is hit, with the result as a reply.
      </p>

      <input
        type="text"
        value={channel}
        onChange={(e) => {
          setChannel(e.target.value);
          setDirty(true);
        }}
        onBlur={() => loadStatus(true)}
        placeholder="@your_channel"
        className="w-full px-2 py-1 text-xs border rounded-md"
      />

      <div className="space-y-1">
        <div className="flex flex-wrap gap-1">
          {coins.map((pair) => (
            <span
              key={pair}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[11px]"
            >
              {pair}
              <button type="button" onClick={() => removeCoin(pair)} className="text-blue-400 hover:text-blue-700">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        {coins.length < MAX_COINS && (
          <>
            <input
              type="text"
              list="autopilot-pairs"
              value={coinInput}
              onChange={(e) => setCoinInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCoin(suggestions[0] ?? coinInput);
                }
              }}
              placeholder={`Add coin (${coins.length}/${MAX_COINS}), e.g. BTC/USDT`}
              className="w-full px-2 py-1 text-xs border rounded-md"
            />
            <datalist id="autopilot-pairs">
              {suggestions.map((pair) => (
                <option key={pair} value={pair} />
              ))}
            </datalist>
          </>
        )}
      </div>

      <div className="flex gap-1.5">
        <select
          value={timeframe}
          onChange={(e) => {
            setTimeframe(e.target.value);
            setDirty(true);
          }}
          className="flex-1 min-w-0 px-2 py-1 text-xs border rounded-md bg-white"
        >
          {TIMEFRAMES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-gray-600 whitespace-nowrap">
          profit ≥
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
            className="w-14 px-1 py-0.5 border rounded text-[11px]"
          />
          %
        </label>
      </div>

      <button
        type="button"
        onClick={() => save(true)}
        disabled={saving || (!dirty && enabled)}
        className={`w-full py-1 rounded-md text-xs font-medium border transition-colors
          ${saving || (!dirty && enabled)
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'}`}
      >
        {saving ? 'Saving...' : enabled ? (dirty ? 'Update autopilot' : 'Autopilot running') : 'Start autopilot'}
      </button>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {status?.config && (
        <div className="border-t pt-2 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            <span>
              {status.lastScanAt ? `Last scan ${formatTime(status.lastScanAt)}` : 'No scan yet'}
              {status.lastError && <span className="text-red-500"> · {status.lastError}</span>}
            </span>
            <button
              type="button"
              onClick={() => loadStatus(false)}
              disabled={refreshing}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {status.lastScan && status.lastScan.results.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-gray-500">Last scan</p>
              {status.lastScan.results.map((r) => <ScanRow key={r.coin} result={r} />)}
            </div>
          )}
          {openTrades.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-gray-500">Open</p>
              {openTrades.map((t) => <TradeRow key={`${t.symbol}-${t.openedAt}`} trade={t} />)}
            </div>
          )}
          {recentTrades.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-gray-500">Closed</p>
              {recentTrades.slice(0, 5).map((t) => <TradeRow key={`${t.symbol}-${t.openedAt}`} trade={t} />)}
            </div>
          )}
          {openTrades.length === 0 && recentTrades.length === 0 && !status.lastScan && (
            <p className="text-[10px] text-gray-400">
              Waiting for a Low-risk signal. {TELEGRAM_BOT_USERNAME} must be an admin of the channel.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AutopilotPanel;
