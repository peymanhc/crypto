import React, { useEffect, useState } from 'react';
import { TradePlan, RiskLevel } from '../types/trading';
import { TIMEFRAMES } from '../constants/trading';
import { fetchCurrentPrice, sendSignalToTelegram, isTelegramConfigured, TELEGRAM_BOT_USERNAME } from '../services/api';
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
  return value >= 1 ? value.toFixed(2) : Number(value.toPrecision(5)).toString();
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

  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
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

  const handleSendToTelegram = async () => {
    if (!channel.trim()) return;
    setSendState('sending');
    try {
      await sendSignalToTelegram(signalText, channel);
      setSendState('sent');
    } catch {
      setSendState('error');
    }
    setTimeout(() => setSendState('idle'), 2500);
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

      {isTrade && isTelegramConfigured && (
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
              onClick={handleSendToTelegram}
              disabled={sendState === 'sending' || !channel.trim()}
              title="Send to your Telegram channel"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                ${sendState === 'sent'
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : sendState === 'error'
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : sendState === 'sending' || !channel.trim()
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'}`}
            >
              {sendState === 'sent' ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {sendState === 'sent' ? 'Sent!' : sendState === 'error' ? 'Failed' : sendState === 'sending' ? 'Sending...' : 'Send'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400">
            {sendState === 'error'
              ? `Could not post — make sure ${TELEGRAM_BOT_USERNAME} is an admin of that channel.`
              : `Add ${TELEGRAM_BOT_USERNAME} as an admin of your channel, then Send posts this signal there.`}
          </p>
        </div>
      )}

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
