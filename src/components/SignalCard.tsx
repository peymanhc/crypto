import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TradePlan } from '../types/trading';
import { TIMEFRAMES } from '../constants/trading';
import {
  fetchCurrentPrice,
  sendSignalToTelegram,
  isTelegramConfigured,
  TELEGRAM_BOT_USERNAME,
  isAutoCloseAvailable,
  scheduleCloseMessage,
} from '../services/api';
import { Zap, Timer, TrendingUp, TrendingDown, RefreshCw, Copy, Check, Send } from 'lucide-react';
import Card from './ui/Card';
import PlanLadder from './signal/PlanLadder';
import { useI18n } from '../i18n';
import { RiskBadge } from './ui/Badge';

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
  if (timeframe.endsWith('w')) return amount * 604_800_000;
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

interface Evaluation {
  exitPrice: number;
  pnlPct: number;
}

interface LiveCheck extends Evaluation {
  at: string;
}

const SignalCard: React.FC<SignalCardProps> = ({ symbol, timeframe, plan, submittedAt }) => {
  const { t, ttf } = useI18n();
  const isTrade = plan.direction !== 'Neutral';
  const dirColor = plan.direction === 'Long' ? 'text-long' : 'text-short';
  const timeframeLabel = TIMEFRAMES.some((tf) => tf.value === timeframe) ? ttf(timeframe) : timeframe;

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

  const clampedProfitTarget = () => Math.min(100, Math.max(0.1, Number(profitTargetPct) || 2));

  const sendToChannel = async (action: TgAction, text: string) => {
    if (!channel.trim() || tgState?.status === 'sending') return;
    setTgState({ action, status: 'sending' });
    try {
      const messageId = await sendSignalToTelegram(text, channel);
      setTgState({ action, status: 'sent' });
      // The Worker holds the timer / price-watch server-side, so it fires even if the browser closes
      if (action === 'signal' && closeMode !== 'none' && isAutoCloseAvailable) {
        try {
          const trade = {
            symbol: symbol.replace('/', ''),
            base: baseAsset(symbol),
            direction: plan.direction,
            entry: plan.entry,
            leverage: plan.leverage,
          };
          await scheduleCloseMessage(channel, {
            text: `CLOSE $${baseAsset(symbol)}`,
            ...(closeMode === 'time'
              ? { delaySeconds: Math.max(1, Math.round(durationMs / 1000)) }
              : { targetPct: clampedProfitTarget() }),
            trade,
            // The CLOSE lands as a reply to the signal it belongs to
            replyToMessageId: messageId,
          });
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
    if (tgState.status === 'sending') return t('common.sending');
    if (tgState.status === 'sent') return t('common.sent');
    return t('common.failed');
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

  const countdownProgress = Math.max(0, Math.min(1, 1 - (remaining * 1000) / durationMs));

  return (
    <Card
      title={t('signal.title')}
      icon={<Zap className="h-4 w-4" />}
      className="h-full"
      delay={0.1}
      right={
        <>
          {isTrade && <RiskBadge level={plan.riskLevel} />}
          <span className="chip border-white/10 bg-white/[0.05] text-slate-300">{timeframeLabel}</span>
        </>
      }
    >
      <div className="flex h-full flex-col gap-3">
        {isTrade ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div dir="ltr" className="relative rounded-xl border border-white/[0.06] bg-ink-900/70 p-3.5 text-start font-mono text-sm leading-6 sm:col-span-3">
              <button
                type="button"
                onClick={handleCopy}
                title={t('common.copy')}
                className={`absolute right-2 top-2 flex items-center gap-1 rounded-lg border px-2 py-1 font-sans text-xs font-medium transition-all
                  ${copied ? 'border-long/40 bg-long/15 text-long' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('common.copied') : t('common.copy')}
              </button>
              <p className={`flex items-center gap-1.5 text-base font-bold ${dirColor}`}>
                {plan.direction === 'Long' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                ${baseAsset(symbol)} | {plan.direction.toUpperCase()}
              </p>
              <p className="text-slate-300">leverage: <span className="text-white">{plan.leverage}x</span></p>
              <p className="text-slate-300">Entry: <span className="text-white">{formatPrice(plan.entry)}</span></p>
              {plan.takeProfits.map((tp, index) => (
                <p key={index} className="text-slate-300">TP{index + 1}: <span className="text-long">{formatPrice(tp)}</span></p>
              ))}
              <p className="text-slate-300">SL: <span className="text-short">{formatPrice(plan.stopLoss)}</span></p>
            </div>
            <div className="sm:col-span-2">
              <p className="label">{t('signal.ladder')}</p>
              <PlanLadder plan={plan} />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.05] text-slate-400">
              <Timer className="h-5 w-5" />
            </span>
            <p className="text-sm text-slate-400">{t('signal.noSignal', { timeframe: timeframeLabel })}</p>
          </div>
        )}

        {isTrade && isTelegramConfigured && (() => {
          const busy = tgState?.status === 'sending';
          const disabled = busy || !channel.trim();
          const buttonClass = (action: TgAction, idleColors: string) =>
            `btn !py-1.5 text-xs
             ${tgState?.action === action && tgState.status === 'sent'
              ? 'border-long/40 bg-long/15 text-long'
              : tgState?.action === action && tgState.status === 'error'
                ? 'border-short/40 bg-short/15 text-short'
                : idleColors}`;
          return (
            <div className="shrink-0 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="label !mb-0">{t('signal.telegram')}</p>
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
                  onClick={() => sendToChannel('signal', signalText)}
                  disabled={disabled}
                  title={t('signal.sendTitle')}
                  className={buttonClass('signal', 'border-glow-cyan/40 bg-glow-cyan/10 text-glow-cyan hover:bg-glow-cyan/20')}
                >
                  {tgState?.action === 'signal' && tgState.status === 'sent'
                    ? <Check className="h-3.5 w-3.5" />
                    : <Send className="h-3.5 w-3.5" />}
                  {tgButtonLabel('signal', t('common.send'))}
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => sendToChannel('close', `CLOSE $${baseAsset(symbol)}`)}
                  disabled={disabled}
                  title={t('signal.postTitle', { text: `CLOSE $${baseAsset(symbol)}` })}
                  className={`flex-1 ${buttonClass('close', 'border-glow-amber/40 bg-glow-amber/10 text-glow-amber hover:bg-glow-amber/20')}`}
                >
                  {tgButtonLabel('close', `CLOSE $${baseAsset(symbol)}`)}
                </button>
                <button
                  type="button"
                  onClick={() => sendToChannel('exit', `EXIT $${baseAsset(symbol)}`)}
                  disabled={disabled}
                  title={t('signal.postTitle', { text: `EXIT $${baseAsset(symbol)}` })}
                  className={`flex-1 ${buttonClass('exit', 'border-short/40 bg-short/10 text-short hover:bg-short/20')}`}
                >
                  {tgButtonLabel('exit', `EXIT $${baseAsset(symbol)}`)}
                </button>
              </div>
              {isAutoCloseAvailable && (
                <div className="space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={closeMode === 'time'}
                      onChange={(e) => handleCloseModeToggle('time', e.target.checked)}
                    />
                    <span>
                      {t('signal.autoCloseTime', { base: baseAsset(symbol), timeframe: timeframeLabel })}
                      {closeMode === 'time' && autoCloseStatus === 'scheduled' && (
                        <span className="font-medium text-long"> {t('signal.scheduled')}</span>
                      )}
                      {closeMode === 'time' && autoCloseStatus === 'failed' && (
                        <span className="font-medium text-short"> {t('signal.scheduleFailed')}</span>
                      )}
                    </span>
                  </label>
                  <label className="flex cursor-pointer flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={closeMode === 'profit'}
                      onChange={(e) => handleCloseModeToggle('profit', e.target.checked)}
                    />
                    {t('signal.autoCloseProfit')}
                    {closeMode === 'profit' && (
                      <input
                        type="number"
                        min={0.1}
                        max={100}
                        step={0.1}
                        value={profitTargetPct}
                        onChange={(e) => handleProfitTargetChange(e.target.value)}
                        className="field !w-16 !px-1.5 !py-0.5 text-[11px]"
                      />
                    )}
                    % <span className="text-slate-500">{t('signal.autoCloseNote')}</span>
                    {closeMode === 'profit' && autoCloseStatus === 'scheduled' && (
                      <span className="font-medium text-long">{t('signal.watching', { pct: clampedProfitTarget() })}</span>
                    )}
                    {closeMode === 'profit' && autoCloseStatus === 'failed' && (
                      <span className="font-medium text-short">{t('signal.scheduleFailed')}</span>
                    )}
                  </label>
                </div>
              )}
              <p className="text-[10px] text-slate-500">
                {tgState?.status === 'error'
                  ? t('signal.botError', { bot: TELEGRAM_BOT_USERNAME })
                  : t('signal.botHint', { bot: TELEGRAM_BOT_USERNAME })}
              </p>
            </div>
          );
        })()}

        {isTrade && !evaluation && !evalError && (
          <div className="relative shrink-0 space-y-2 overflow-hidden rounded-xl border border-glow-blue/20 bg-glow-blue/[0.07] px-3 py-2.5 text-sm text-slate-200">
            <span dir="ltr" className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.06]">
              <motion.span
                className="block h-full bg-gradient-to-r from-glow-cyan to-glow-blue"
                animate={{ width: `${countdownProgress * 100}%` }}
                transition={{ ease: 'linear', duration: 1 }}
              />
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Timer className="h-4 w-4 text-glow-blue" />
                {t('signal.resultAfter', { timeframe: timeframeLabel })}
              </span>
              <div className="flex items-center gap-2">
                <span className="num font-semibold text-white">{formatCountdown(remaining)}</span>
                <button type="button" onClick={handleCheckNow} disabled={isChecking} className="btn-ghost !px-2 !py-1 text-xs">
                  <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
                  {t('signal.checkNow')}
                </button>
              </div>
            </div>
            {liveCheck && (
              <p className={`text-xs font-medium ${liveCheck.pnlPct >= 0 ? 'text-long' : 'text-short'}`}>
                {t('signal.now', {
                  time: liveCheck.at,
                  pnl: `${liveCheck.pnlPct >= 0 ? '+' : ''}${liveCheck.pnlPct.toFixed(2)}`,
                  price: formatPrice(liveCheck.exitPrice),
                  leverage: plan.leverage,
                })}
              </p>
            )}
          </div>
        )}

        {isTrade && evaluation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm ${
              evaluation.pnlPct >= 0 ? 'border-long/30 bg-long/10 text-long' : 'border-short/30 bg-short/10 text-short'
            }`}
          >
            <span className="flex items-center gap-1.5 font-bold">
              {evaluation.pnlPct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {evaluation.pnlPct >= 0 ? t('signal.profit') : t('signal.loss')}: {evaluation.pnlPct >= 0 ? '+' : ''}
              {evaluation.pnlPct.toFixed(2)}%
            </span>
            <span className="mt-0.5 block text-xs opacity-80">
              {t('signal.evaluation', {
                timeframe: timeframeLabel,
                price: formatPrice(evaluation.exitPrice),
                entry: formatPrice(plan.entry),
                leverage: plan.leverage,
              })}
            </span>
          </motion.div>
        )}

        {isTrade && evalError && (
          <p className="shrink-0 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
            {t('signal.evalError')}
          </p>
        )}
      </div>
    </Card>
  );
};

export default SignalCard;
