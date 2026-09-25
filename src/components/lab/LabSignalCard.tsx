import { useState } from 'react';
import { Zap, Copy, Check, Send, Timer } from 'lucide-react';
import { TradePlan } from '../../types/trading';
import { formatSignalText, baseAsset } from '../../lib/analysis';
import { sendSignalToTelegram, isTelegramConfigured, TELEGRAM_BOT_USERNAME } from '../../services/api';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import { RiskBadge } from '../ui/Badge';
import PlanLadder from '../signal/PlanLadder';

interface LabSignalCardProps {
  symbol: string;
  timeframe: string;
  plan: TradePlan;
  engineLabel: string;
}

type Action = 'signal' | 'close' | 'exit';
type Status = 'sending' | 'sent' | 'error';

// The signal produced by the active engine. The text comes from the very same
// formatSignalText the Dashboard and the autopilot use, so the format is identical.
const LabSignalCard: React.FC<LabSignalCardProps> = ({ symbol, timeframe, plan, engineLabel }) => {
  const { t, ttf } = useI18n();
  const isTrade = plan.direction !== 'Neutral';
  const base = baseAsset(symbol);
  const signalText = formatSignalText(symbol, plan);
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState(() => {
    try {
      return localStorage.getItem('telegram-channel') ?? '';
    } catch {
      return '';
    }
  });
  const [state, setState] = useState<{ action: Action; status: Status } | null>(null);

  const changeChannel = (value: string) => {
    setChannel(value);
    try {
      localStorage.setItem('telegram-channel', value);
    } catch {
      // storage unavailable
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(signalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing else to do
    }
  };

  const send = async (action: Action, text: string) => {
    if (!channel.trim() || state?.status === 'sending') return;
    setState({ action, status: 'sending' });
    try {
      await sendSignalToTelegram(text, channel);
      setState({ action, status: 'sent' });
    } catch {
      setState({ action, status: 'error' });
    }
    setTimeout(() => setState(null), 2500);
  };

  const label = (action: Action, idle: string) => {
    if (state?.action !== action) return idle;
    if (state.status === 'sending') return t('common.sending');
    if (state.status === 'sent') return t('common.sent');
    return t('common.failed');
  };

  const buttonClass = (action: Action, idle: string) =>
    `btn !py-1.5 text-xs ${state?.action === action && state.status === 'sent' ? 'border-long/40 bg-long/15 text-long' : state?.action === action && state.status === 'error' ? 'border-short/40 bg-short/15 text-short' : idle}`;

  const disabled = !channel.trim() || state?.status === 'sending';

  return (
    <Card
      title={t('signal.title')}
      icon={<Zap className="h-4 w-4" />}
      hover={false}
      right={
        <>
          {isTrade && <RiskBadge level={plan.riskLevel} />}
          <span className="chip border-white/10 bg-white/[0.05] text-slate-300">{ttf(timeframe)}</span>
        </>
      }
    >
      <p className="mb-3 text-[11px] text-slate-500">{t('lab.engineUsed', { engine: engineLabel })}</p>

      {!isTrade ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.05] text-slate-400"><Timer className="h-5 w-5" /></span>
          <p className="text-sm text-slate-400">{t('lab.noSignal', { timeframe: ttf(timeframe) })}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <pre dir="ltr" className="relative whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-ink-900/70 p-3.5 text-start font-mono text-sm leading-6 text-slate-200 sm:col-span-3">
              <button type="button" onClick={copy} className={`absolute right-2 top-2 flex items-center gap-1 rounded-lg border px-2 py-1 font-sans text-xs font-medium ${copied ? 'border-long/40 bg-long/15 text-long' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('common.copied') : t('common.copy')}
              </button>
              {signalText}
            </pre>
            <div className="sm:col-span-2">
              <p className="label">{t('signal.ladder')}</p>
              <PlanLadder plan={plan} />
            </div>
          </div>

          {isTelegramConfigured && (
            <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="label !mb-0">{t('signal.telegram')}</p>
              <div className="flex gap-1.5">
                <input type="text" value={channel} onChange={(e) => changeChannel(e.target.value)} placeholder={t('common.channelPlaceholder')} className="field min-w-0 flex-1 !py-1.5 text-xs" />
                <button type="button" onClick={() => send('signal', signalText)} disabled={disabled} title={t('signal.sendTitle')} className={buttonClass('signal', 'border-glow-cyan/40 bg-glow-cyan/10 text-glow-cyan hover:bg-glow-cyan/20')}>
                  <Send className="h-3.5 w-3.5" /> {label('signal', t('common.send'))}
                </button>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => send('close', `CLOSE $${base}`)} disabled={disabled} title={t('signal.postTitle', { text: `CLOSE $${base}` })} className={`flex-1 ${buttonClass('close', 'border-glow-amber/40 bg-glow-amber/10 text-glow-amber hover:bg-glow-amber/20')}`}>
                  {label('close', `CLOSE $${base}`)}
                </button>
                <button type="button" onClick={() => send('exit', `EXIT $${base}`)} disabled={disabled} title={t('signal.postTitle', { text: `EXIT $${base}` })} className={`flex-1 ${buttonClass('exit', 'border-short/40 bg-short/10 text-short hover:bg-short/20')}`}>
                  {label('exit', `EXIT $${base}`)}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                {state?.status === 'error' ? t('signal.botError', { bot: TELEGRAM_BOT_USERNAME }) : t('signal.botHint', { bot: TELEGRAM_BOT_USERNAME })}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default LabSignalCard;
