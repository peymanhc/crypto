import React, { useEffect, useState } from 'react';
import { CmeGap, TradePlan } from '../types/trading';
import {
  fetchCurrentPrice,
  buildGapFillPlan,
  sendSignalToTelegram,
  isTelegramConfigured,
  TELEGRAM_BOT_USERNAME,
} from '../services/api';
import { ArrowUpRight, ArrowDownRight, X, Copy, Check, Send } from 'lucide-react';

interface GapFillSignalModalProps {
  symbol: string;
  gap: CmeGap;
  onClose: () => void;
}

// "BTC/USDT" -> "BTC"; free-text like "DOGEUSDT" -> "DOGE"
const baseAsset = (symbol: string): string => {
  if (symbol.includes('/')) return symbol.split('/')[0];
  return symbol.replace(/(USDT|USDC|FDUSD|TUSD|BUSD)$/i, '') || symbol;
};

const formatPrice = (value: number): string =>
  value >= 1000 ? value.toFixed(2) : Number(value.toPrecision(5)).toString();

const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

type TgStatus = 'idle' | 'sending' | 'sent' | 'error';

// Builds a trade back to an unfilled CME gap from the live price and lets the user
// copy it or post it to their Telegram channel
const GapFillSignalModal: React.FC<GapFillSignalModalProps> = ({ symbol, gap, onClose }) => {
  const [plan, setPlan] = useState<TradePlan | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  const [channel, setChannel] = useState<string>(() => {
    try {
      return localStorage.getItem('telegram-channel') ?? '';
    } catch {
      return '';
    }
  });
  const [tgStatus, setTgStatus] = useState<TgStatus>('idle');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentPrice(symbol)
      .then((price) => {
        if (cancelled) return;
        const built = buildGapFillPlan(gap, price);
        if (built === null) setAlreadyFilled(true);
        else setPlan(built);
      })
      .catch(() => {
        if (!cancelled) setPriceError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, gap]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const signalText = plan
    ? [
        `$${baseAsset(symbol)} | ${plan.direction.toUpperCase()}`,
        `leverage: ${plan.leverage}x`,
        `Entry: ${formatPrice(plan.entry)}`,
        `TP1: ${formatPrice(plan.takeProfits[0])}`,
        `SL: ${formatPrice(plan.stopLoss)}`,
      ].join('\n')
    : '';

  const handleChannelChange = (value: string) => {
    setChannel(value);
    try {
      localStorage.setItem('telegram-channel', value);
    } catch {
      // storage unavailable — the field still works for this session
    }
  };

  const handleSend = async () => {
    if (!plan || !channel.trim() || tgStatus === 'sending') return;
    setTgStatus('sending');
    try {
      await sendSignalToTelegram(signalText, channel);
      setTgStatus('sent');
    } catch {
      setTgStatus('error');
    }
    setTimeout(() => setTgStatus('idle'), 2500);
  };

  const handleCopy = async () => {
    if (!plan) return;
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

  const dirColor = plan?.direction === 'Long' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg p-4 w-full max-w-sm space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            {gap.sizePct > 0
              ? <ArrowUpRight className="w-4 h-4 text-green-600" />
              : <ArrowDownRight className="w-4 h-4 text-red-600" />}
            CME Gap Fill Signal
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-600">
          Gap opened {formatDate(gap.openedAt)}: {formatPrice(gap.from)} → {formatPrice(gap.to)} (
          {gap.sizePct > 0 ? '+' : ''}{gap.sizePct.toFixed(2)}%). Target is the unfilled gap level at{' '}
          <span className="font-bold">{formatPrice(gap.from)}</span>.
        </p>

        {priceError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
            Could not fetch the current price. Close and try again.
          </p>
        )}

        {alreadyFilled && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            Price is already at the gap level — this gap is effectively filled, nothing to trade.
          </p>
        )}

        {!plan && !priceError && !alreadyFilled && (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">Building signal…</p>
        )}

        {plan && (
          <>
            <div className="relative font-mono text-sm leading-6 bg-gray-50 rounded-lg p-3">
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
              <p>TP1: {formatPrice(plan.takeProfits[0])}</p>
              <p>SL: {formatPrice(plan.stopLoss)}</p>
            </div>

            {isTelegramConfigured ? (
              <div className="space-y-1">
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
                    onClick={handleSend}
                    disabled={tgStatus === 'sending' || !channel.trim()}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                      ${tgStatus === 'sent'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : tgStatus === 'error'
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : tgStatus === 'sending' || !channel.trim()
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'}`}
                  >
                    {tgStatus === 'sent' ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    {tgStatus === 'sent'
                      ? 'Sent!'
                      : tgStatus === 'error'
                        ? 'Failed'
                        : tgStatus === 'sending'
                          ? 'Sending...'
                          : 'Send to Telegram'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  {tgStatus === 'error'
                    ? `Could not post — make sure ${TELEGRAM_BOT_USERNAME} is an admin of that channel.`
                    : `Posts this gap-fill signal to your channel via ${TELEGRAM_BOT_USERNAME}.`}
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-gray-400">Telegram is not configured for this build.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GapFillSignalModal;
