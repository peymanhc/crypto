import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CmeGap, TradePlan } from '../types/trading';
import {
  fetchCurrentPrice,
  buildGapFillPlan,
  sendSignalToTelegram,
  isTelegramConfigured,
  TELEGRAM_BOT_USERNAME,
} from '../services/api';
import { ArrowUpRight, ArrowDownRight, X, Copy, Check, Send } from 'lucide-react';
import Skeleton from './ui/Skeleton';
import { useI18n } from '../i18n';
import Portal from './ui/Portal';

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
  const { t } = useI18n();
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

  const dirColor = plan?.direction === 'Long' ? 'text-long' : 'text-short';

  return (
    <Portal>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="glass w-full max-w-sm space-y-3 rounded-b-none p-5 sm:rounded-2xl"
          style={{ paddingBottom: 'calc(1.25rem + var(--sab))' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
              <span className={`grid h-7 w-7 place-items-center rounded-lg ${gap.sizePct > 0 ? 'bg-long/15 text-long' : 'bg-short/15 text-short'}`}>
                {gap.sizePct > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </span>
              {t('gap.title')}
            </h2>
            <button type="button" onClick={onClose} className="btn-ghost !p-1.5" aria-label={t('common.close')}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="relative text-xs leading-relaxed text-slate-400">
            {t('gap.intro', { date: formatDate(gap.openedAt), from: formatPrice(gap.from), to: formatPrice(gap.to), size: `${gap.sizePct > 0 ? '+' : ''}${gap.sizePct.toFixed(2)}` })}{' '}
            <span className="num font-semibold text-white">{formatPrice(gap.from)}</span>.
          </p>

          {priceError && (
            <p className="relative rounded-xl border border-short/30 bg-short/10 p-3 text-sm text-short">
              {t('gap.priceError')}
            </p>
          )}

          {alreadyFilled && (
            <p className="relative rounded-xl bg-white/[0.04] p-3 text-sm text-slate-300">
              {t('gap.alreadyFilled')}
            </p>
          )}

          {!plan && !priceError && !alreadyFilled && (
            <div className="relative rounded-xl bg-white/[0.04] p-3">
              <Skeleton lines={5} />
            </div>
          )}

          {plan && (
            <>
              <div dir="ltr" className="relative rounded-xl border border-white/[0.06] bg-ink-900/70 p-3.5 text-start font-mono text-sm leading-6">
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy signal"
                  className={`absolute right-2 top-2 flex items-center gap-1 rounded-lg border px-2 py-1 font-sans text-xs font-medium transition-all
                    ${copied ? 'border-long/40 bg-long/15 text-long' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
                <p className={`font-bold ${dirColor}`}>
                  ${baseAsset(symbol)} | {plan.direction.toUpperCase()}
                </p>
                <p className="text-slate-300">leverage: <span className="text-white">{plan.leverage}x</span></p>
                <p className="text-slate-300">Entry: <span className="text-white">{formatPrice(plan.entry)}</span></p>
                <p className="text-slate-300">TP1: <span className="text-long">{formatPrice(plan.takeProfits[0])}</span></p>
                <p className="text-slate-300">SL: <span className="text-short">{formatPrice(plan.stopLoss)}</span></p>
              </div>

              {isTelegramConfigured ? (
                <div className="relative space-y-1.5">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={channel}
                      onChange={(e) => handleChannelChange(e.target.value)}
                      placeholder={t('common.channelPlaceholder')}
                      className="field min-w-0 flex-1 !py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={tgStatus === 'sending' || !channel.trim()}
                      className={`btn !py-1.5 text-xs
                        ${tgStatus === 'sent'
                          ? 'border-long/40 bg-long/15 text-long'
                          : tgStatus === 'error'
                            ? 'border-short/40 bg-short/15 text-short'
                            : 'border-glow-cyan/40 bg-glow-cyan/10 text-glow-cyan hover:bg-glow-cyan/20'}`}
                    >
                      {tgStatus === 'sent' ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                      {tgStatus === 'sent'
                        ? t('common.sent')
                        : tgStatus === 'error'
                          ? t('common.failed')
                          : tgStatus === 'sending'
                            ? t('common.sending')
                            : t('gap.send')}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {tgStatus === 'error'
                      ? t('signal.botError', { bot: TELEGRAM_BOT_USERNAME })
                      : t('gap.hint', { bot: TELEGRAM_BOT_USERNAME })}
                  </p>
                </div>
              ) : (
                <p className="relative text-[10px] text-slate-500">{t('gap.notConfigured')}</p>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
    </Portal>
  );
};

export default GapFillSignalModal;
