import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Plus, X, Check, Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import { TradeWindow, loadWindows, saveWindows, isValidWindow, activeWindow, localTzOffsetMinutes } from '../lib/tradeWindows';
import { fetchAutopilotStatus, saveAutopilot, isAutoCloseAvailable } from '../services/api';
import { useI18n } from '../i18n';
import Card from './ui/Card';

type Sync = 'idle' | 'saving' | 'saved' | 'failed';

// Pushes the windows to the Worker when an autopilot is configured for the stored channel
const syncToAutopilot = async (windows: TradeWindow[]): Promise<Sync> => {
  let channel = '';
  try {
    channel = localStorage.getItem('telegram-channel') ?? '';
  } catch {
    return 'idle';
  }
  if (!channel.trim() || !isAutoCloseAvailable) return 'idle';
  const status = await fetchAutopilotStatus(channel);
  if (!status.config) return 'idle';
  await saveAutopilot({ ...status.config, noTradeWindows: windows, tzOffsetMinutes: localTzOffsetMinutes() });
  return 'saved';
};

// Times of day in which no new trade is opened: by the autopilot (server) and the Hyperliquid auto trader
const NoTradeWindowsCard = () => {
  const { t } = useI18n();
  const [windows, setWindows] = useState<TradeWindow[]>(loadWindows);
  const [draft, setDraft] = useState<TradeWindow>({ from: '08:00', to: '09:00' });
  const [sync, setSync] = useState<Sync>('idle');
  const [now, setNow] = useState(() => new Date());

  // Re-evaluate the "paused now" badge every 30 s
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const apply = async (next: TradeWindow[]) => {
    setWindows(next);
    saveWindows(next);
    setSync('saving');
    try {
      setSync(await syncToAutopilot(next));
    } catch {
      setSync('failed');
    }
  };

  const add = () => {
    if (!isValidWindow(draft)) return;
    apply([...windows, draft]);
  };

  const remove = (index: number) => apply(windows.filter((_, i) => i !== index));

  const paused = activeWindow(windows, now);

  return (
    <Card title={t('windows.title')} icon={<Clock className="h-4 w-4" />} delay={0.12} right={
      <span className={`chip ${paused ? 'border-glow-amber/40 bg-glow-amber/10 text-glow-amber' : 'border-long/30 bg-long/10 text-long'}`}>
        {paused ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
        {paused ? t('windows.pausedNow', { to: paused.to }) : t('windows.tradingNow')}
      </span>
    }>
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-slate-500">{t('windows.description')}</p>

        <div className="space-y-1.5">
          <AnimatePresence>
            {windows.map((w, index) => (
              <motion.div
                layout
                key={`${w.from}-${w.to}-${index}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs"
              >
                <span dir="ltr" className="num text-slate-200">
                  {w.from} <span className="text-slate-500">→</span> {w.to}
                </span>
                <button type="button" onClick={() => remove(index)} className="btn-ghost !p-1" aria-label={t('windows.remove')}>
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {windows.length === 0 && <p className="text-[11px] text-slate-500">{t('windows.empty')}</p>}
        </div>

        <div dir="ltr" className="flex items-center gap-1.5">
          <input type="time" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="field min-w-0 flex-1 !py-1.5 text-xs" aria-label={t('windows.from')} />
          <span className="text-slate-500">→</span>
          <input type="time" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="field min-w-0 flex-1 !py-1.5 text-xs" aria-label={t('windows.to')} />
          <button type="button" onClick={add} disabled={!isValidWindow(draft)} className="btn-ghost !px-2.5 !py-1.5" aria-label={t('windows.add')}>
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
          {sync === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> {t('windows.syncing')}</>}
          {sync === 'saved' && <><Check className="h-3 w-3 text-long" /> {t('windows.synced')}</>}
          {sync === 'failed' && <span className="text-short">{t('windows.syncFailed')}</span>}
          {sync === 'idle' && t('windows.hint')}
        </p>
      </div>
    </Card>
  );
};

export default NoTradeWindowsCard;
