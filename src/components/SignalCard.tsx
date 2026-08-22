import React, { useEffect, useState } from 'react';
import { TradePlan, RiskLevel } from '../types/trading';
import { TIMEFRAMES } from '../constants/trading';
import {
  fetchCurrentPrice,
  sendSignalToTelegram,
  isTelegramConfigured,
  TELEGRAM_BOT_USERNAME,
  isAutoCloseAvailable,
  scheduleTelegramMessage,
  scheduleProfitClose,
} from '../services/api';
import { Zap, ShieldCheck, ShieldAlert, ShieldX, Timer, TrendingUp, TrendingDown, RefreshCw, Copy, Check, Send } from 'lucide-react';

interface SignalCardProps {
  symbol: string;
  timeframe: string;
  plan: TradePlan;
  submittedAt: number;
}

// "BTC/USDT" -> "BTC"; free-text like "DOGEUSDT" -> "DOGE"
const baseAsset = (symbol: string): string => {
  if (symbol.includes('/')) return symbol.split('/')[0];
  return symbol.replace(/(USDT|USDC|FDUSD|TUSD|BUSD)$/i, '') || symbol;
};

const formatPrice = (value?: number): string => {
  if (value === undefined) return '—';
  // Two decimals is only enough for high-priced coins; keep 5 significant
  // digits below 1000 so ATR-spaced TP levels stay distinguishable
  return value >= 1000 ? value.toFixed(2) : Number(value.toPrecision(5)).toString();
};

const timeframeMs = (timeframe: string): number => {
  const amount = parseInt(timeframe, 10);
  if (timeframe.endsWith('d')) return amount * 86_400_000;
  if (timeframe.endsWith('h')) return amount * 3_600_000;
  return amount * 60_000; // minutes
};

const formatCountdown = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const riskStyles: Record<RiskLevel, string> = {
  Low: 'bg-green-100 text-green-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-red-100 text-red-700',
};

const riskIcons: Record<RiskLevel, React.ReactNode> = {
  Low: <ShieldCheck className="w-3.5 h-3.5" />,
  Medium: <ShieldAlert className="w-3.5 h-3.5" />,
  High: <ShieldX className="w-3.5 h-3.5" />,
};

interface Evaluation {
  exitPrice: number;
  pnlPct: number;
}

interface LiveCheck extends Evaluation {
  at: string;
}

const SignalCard: React.FC<SignalCardProps> = ({ symbol, timeframe, plan, submittedAt }) => {
  const isTrade = plan.direction !== 'Neutral';
  const dirColor = plan.direction === 'Long' ? 'text-green-600' : 'text-red-600';
  const timeframeLabel = TIMEFRAMES.find((tf) => tf.value === timeframe)?.label ?? timeframe;

  const durationMs = timeframeMs(timeframe);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((submittedAt + durationMs - Date.now()) / 1000))
  );
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evalError, setEvalError] = useState(false);
  const [liveCheck, setLiveCheck] = useState<LiveCheck | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const pnlAt = (exitPrice: number): number => {
    const direction = plan.direction === 'Long' ? 1 : -1;
    return ((exitPrice - plan.entry) / plan.entry) * 100 * plan.leverage * direction;
  };

  const [copied, setCopied] = useState(false);

  const signalText = [
    `$${baseAsset(symbol)} | ${plan.direction.toUpperCase()}`,
    `leverage: ${plan.leverage}x`,
    `Entry: ${formatPrice(plan.entry)}`,
    ...plan.takeProfits.map((tp, index) => `TP${index + 1}: ${formatPrice(tp)}`),
    `SL: ${formatPrice(plan.stopLoss)}`,
  ].join('\n');

  type TgAction = 'signal' | 'close' | 'exit';
  const [tgState, setTgState] = useState<{ action: TgAction; status: 'sending' | 'sent' | 'error' } | null>(null);
  const [channel, setChannel] = useState<string>(() => {
    try {
      return localStorage.getItem('telegram-channel') ?? '';
    } catch {
      return '';
    }
  });

  const handleChannelChange = (value: string) => {
    setChannel(value);
    try {
      localStorage.setItem('telegram-channel', value);
    } catch {
      // storage unavailable (private mode etc.) — the field still works for this session
    }
  };

  type CloseMode = 'none' | 'time' | 'profit';
  const [closeMode, setCloseMode] = useState<CloseMode>(() => {
    try {
      const stored = localStorage.getItem('telegram-close-mode');
      return stored === 'time' || stored === 'profit' ? stored : 'none';
    } catch {
      return 'none';
    }
  });
  const [profitTargetPct, setProfitTargetPct] = useState<string>(() => {
    try {
      return localStorage.getItem('telegram-profit-target') ?? '2';
    } catch {
      return '2';
    }
  });
  const [autoCloseStatus, setAutoCloseStatus] = useState<'scheduled' | 'failed' | null>(null);

  // The two auto-close options are mutually exclusive: checking one unchecks the other
  const handleCloseModeToggle = (mode: 'time' | 'profit', checked: boolean) => {
    const next: CloseMode = checked ? mode : 'none';
    setCloseMode(next);
    try {
      localStorage.setItem('telegram-close-mode', next);
    } catch {
      // storage unavailable — checkbox still works for this session
    }
  };

  const handleProfitTargetChange = (value: string) => {
    setProfitTargetPct(value);
    try {
      localStorage.setItem('telegram-profit-target', value);
    } catch {
      // storage unavailable
    }
  };

  const clampedProfitTarget = () => Math.min(100, Math.max(1, Number(profitTargetPct) || 2));

  const sendToChannel = async (action: TgAction, text: string) => {
    if (!channel.trim() || tgState?.status === 'sending') return;
    setTgState({ action, status: 'sending' });
    try {
      await sendSignalToTelegram(text, channel);
      setTgState({ action, status: 'sent' });
      // The Worker holds the timer / price-watch server-side, so it fires even if the browser closes
      if (action === 'signal' && closeMode !== 'none' && isAutoCloseAvailable) {
        try {
          const closeText = `CLOSE $${baseAsset(symbol)}`;
          if (closeMode === 'time') {
            await scheduleTelegramMessage(channel, closeText, Math.max(1, Math.round(durationMs / 1000)));
          } else {
            await scheduleProfitClose(channel, closeText, {
              symbol: symbol.replace('/', ''),
              direction: plan.direction as 'Long' | 'Short',
              entry: plan.entry,
              leverage: plan.leverage,
              targetPct: clampedProfitTarget(),
            });
          }
          setAutoCloseStatus('scheduled');
        } catch {
          setAutoCloseStatus('failed');
        }
      }
    } catch {
      setTgState({ action, status: 'error' });
    }
    setTimeout(() => setTgState(null), 2500);
  };

  const tgButtonLabel = (action: TgAction, idle: string): string => {
    if (tgState?.action !== action) return idle;
    if (tgState.status === 'sending') return 'Sending...';
    if (tgState.status === 'sent') return 'Sent!';
    return 'Failed';
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(signalText);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = signalText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      const exitPrice = await fetchCurrentPrice(symbol);
      setLiveCheck({ exitPrice, pnlPct: pnlAt(exitPrice), at: new Date().toLocaleTimeString() });
    } catch {
      setLiveCheck(null);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!isTrade) return;
    const endAt = submittedAt + durationMs;
    const update = () => setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isTrade, submittedAt, durationMs]);

  useEffect(() => {
    if (!isTrade || remaining > 0 || evaluation || evalError) return;
    let cancelled = false;
    fetchCurrentPrice(symbol)
      .then((exitPrice) => {
        if (cancelled) return;
        const direction = plan.direction === 'Long' ? 1 : -1;
        const pnlPct = ((exitPrice - plan.entry) / plan.entry) * 100 * plan.leverage * direction;
        setEvaluation({ exitPrice, pnlPct });
      })
      .catch(() => {
        if (!cancelled) setEvalError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isTrade, remaining, evaluation, evalError, symbol, plan]);

  return (
    <div className="bg-white rounded-lg p-4 space-y-2 h-full flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-yellow-500" />
          Signal
        </h2>
        <div className="flex items-center gap-2">
          {isTrade && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${riskStyles[plan.riskLevel]}`}
            >
              {riskIcons[plan.riskLevel]}
              {plan.riskLevel} Risk
            </span>
          )}
          <span className="text-xs text-gray-400">{timeframeLabel}</span>
        </div>
      </div>

      {isTrade ? (
        <div className="relative font-mono text-sm leading-6 bg-gray-50 rounded-lg p-3 flex-1">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy signal"
            className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-sans font-medium border transition-colors
              ${copied
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <p className={`font-bold ${dirColor}`}>
            ${baseAsset(symbol)} | {plan.direction.toUpperCase()}
          </p>
          <p>leverage: {plan.leverage}x</p>
          <p>Entry: {formatPrice(plan.entry)}</p>
          {plan.takeProfits.map((tp, index) => (
            <p key={index}>TP{index + 1}: {formatPrice(tp)}</p>
          ))}
          <p>SL: {formatPrice(plan.stopLoss)}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 flex-1">
          No trade signal on the {timeframeLabel} timeframe right now — the market is sideways. Wait for a clear setup.
        </p>
      )}

      {isTrade && isTelegramConfigured && (() => {
        const busy = tgState?.status === 'sending';
        const disabled = busy || !channel.trim();
        const buttonClass = (action: TgAction, idleColors: string) =>
          `flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
           ${tgState?.action === action && tgState.status === 'sent'
            ? 'bg-green-50 border-green-300 text-green-700'
            : tgState?.action === action && tgState.status === 'error'
              ? 'bg-red-50 border-red-300 text-red-700'
              : disabled
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : idleColors}`;
        return (
          <div className="shrink-0 space-y-1">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={channel}
                onChange={(e) => handleChannelChange(e.target.value)}
                placeholder="@your_channel"
                className="flex-1 min-w-0 px-2 py-1 text-xs border rounded-md"
              />
              <button
                type="button"
                onClick={() => sendToChannel('signal', signalText)}
                disabled={disabled}
                title="Send this signal to your Telegram channel"
                className={buttonClass('signal', 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50')}
              >
                {tgState?.action === 'signal' && tgState.status === 'sent'
                  ? <Check className="w-3.5 h-3.5" />
                  : <Send className="w-3.5 h-3.5" />}
                {tgButtonLabel('signal', 'Send')}
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => sendToChannel('close', `CLOSE $${baseAsset(symbol)}`)}
                disabled={disabled}
                title={`Post "CLOSE $${baseAsset(symbol)}" to your channel`}
                className={`flex-1 ${buttonClass('close', 'bg-white border-amber-300 text-amber-600 hover:bg-amber-50')}`}
              >
                {tgButtonLabel('close', `CLOSE $${baseAsset(symbol)}`)}
              </button>
              <button
                type="button"
                onClick={() => sendToChannel('exit', `EXIT $${baseAsset(symbol)}`)}
                disabled={disabled}
                title={`Post "EXIT $${baseAsset(symbol)}" to your channel`}
                className={`flex-1 ${buttonClass('exit', 'bg-white border-red-300 text-red-600 hover:bg-red-50')}`}
              >
                {tgButtonLabel('exit', `EXIT $${baseAsset(symbol)}`)}
              </button>
            </div>
            {isAutoCloseAvailable && (
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closeMode === 'time'}
                    onChange={(e) => handleCloseModeToggle('time', e.target.checked)}
                  />
                  Auto-send CLOSE ${baseAsset(symbol)} after one {timeframeLabel} candle
                  {closeMode === 'time' && autoCloseStatus === 'scheduled' && (
                    <span className="text-green-600 font-medium">— scheduled ✓</span>
                  )}
                  {closeMode === 'time' && autoCloseStatus === 'failed' && (
                    <span className="text-red-600 font-medium">— scheduling failed</span>
                  )}
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer flex-wrap">
                  <input
                    type="checkbox"
                    checked={closeMode === 'profit'}
                    onChange={(e) => handleCloseModeToggle('profit', e.target.checked)}
                  />
                  Auto-send CLOSE ${baseAsset(symbol)} at leveraged profit ≥
                  {closeMode === 'profit' && (
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      value={profitTargetPct}
                      onChange={(e) => handleProfitTargetChange(e.target.value)}
                      className="w-14 px-1 py-0.5 border rounded text-[11px]"
                    />
                  )}
                  % <span className="text-gray-400">(price checked every 3s, server-side)</span>
                  {closeMode === 'profit' && autoCloseStatus === 'scheduled' && (
                    <span className="text-green-600 font-medium">— watching ✓</span>
                  )}
                  {closeMode === 'profit' && autoCloseStatus === 'failed' && (
                    <span className="text-red-600 font-medium">— scheduling failed</span>
                  )}
                </label>
              </div>
            )}
            <p className="text-[10px] text-gray-400">
              {tgState?.status === 'error'
                ? `Could not post — make sure ${TELEGRAM_BOT_USERNAME} is an admin of that channel.`
                : `Add ${TELEGRAM_BOT_USERNAME} as an admin of your channel, then these buttons post there.`}
            </p>
          </div>
        );
      })()}

      {isTrade && !evaluation && !evalError && (
        <div className="bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-sm shrink-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Timer className="w-4 h-4" />
              Result check after one {timeframeLabel} candle
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">{formatCountdown(remaining)}</span>
              <button
                type="button"
                onClick={handleCheckNow}
                disabled={isChecking}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border border-blue-300 transition-colors
                  ${isChecking ? 'bg-blue-100 cursor-not-allowed' : 'bg-white hover:bg-blue-100'}`}
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                Check now
              </button>
            </div>
          </div>
          {liveCheck && (
            <p className={`text-xs font-medium ${liveCheck.pnlPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Now ({liveCheck.at}): {liveCheck.pnlPct >= 0 ? '+' : ''}{liveCheck.pnlPct.toFixed(2)}% at price{' '}
              {formatPrice(liveCheck.exitPrice)} with {plan.leverage}x leverage.
            </p>
          )}
        </div>
      )}

      {isTrade && evaluation && (
        <div
          className={`rounded-lg px-3 py-2 text-sm shrink-0 ${
            evaluation.pnlPct >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          <span className="flex items-center gap-1.5 font-bold">
            {evaluation.pnlPct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {evaluation.pnlPct >= 0 ? 'Profit' : 'Loss'}: {evaluation.pnlPct >= 0 ? '+' : ''}
            {evaluation.pnlPct.toFixed(2)}%
          </span>
          <span className="block text-xs mt-0.5">
            Price after one {timeframeLabel} candle: {formatPrice(evaluation.exitPrice)} — if you had opened this
            trade at {formatPrice(plan.entry)} with {plan.leverage}x leverage.
          </span>
        </div>
      )}

      {isTrade && evalError && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 shrink-0">
          Could not fetch the price for the result check. Submit again to retry.
        </p>
      )}
    </div>
  );
};

export default SignalCard;
