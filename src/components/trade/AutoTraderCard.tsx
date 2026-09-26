import { useEffect, useState } from 'react';
import { Bot, Radar, X } from 'lucide-react';
import { RiskLevel } from '../../types/trading';
import { AutoTradeConfig, AutoTradeScanResult } from '../../types/hyperliquid';
import { TIMEFRAMES } from '../../constants/trading';
import { fetchTradingPairs } from '../../services/api';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import CoinSearchInput from '../ui/CoinSearchInput';
import { hlErrorText } from './errors';

interface AutoTraderCardProps {
  config: AutoTradeConfig;
  loggedIn: boolean;
  scanning: boolean;
  lastScan: { at: number; results: AutoTradeScanResult[] } | null;
  onChange: (next: Partial<AutoTradeConfig>) => void;
  onToggleRisk: (level: RiskLevel, on: boolean) => void;
  onScanNow: () => void;
}

const MAX_COINS = 4;
const RISK_LEVELS: RiskLevel[] = ['Low', 'Medium', 'High'];
const riskColor: Record<RiskLevel, string> = { Low: 'text-long', Medium: 'text-glow-amber', High: 'text-short' };

const toPair = (raw: string) => {
  const value = raw.trim().toUpperCase();
  return value.includes('/') ? value : value.replace(/^(.+?)(USDT|USDC|FDUSD|TUSD|BUSD)$/, '$1/$2');
};

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// One line per coin from the latest scan
const ScanRow: React.FC<{ result: AutoTradeScanResult }> = ({ result }) => {
  const { t } = useI18n();
  const color = result.status === 'opened' ? 'text-long' : result.status === 'error' ? 'text-short' : 'text-slate-500';
  const text = result.status === 'error' ? hlErrorText(result.error ?? '', t) : t(`hl.auto.status.${result.status}`);
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[11px]">
      <span className="font-mono text-slate-200">
        {result.coin}
        {result.direction && result.direction !== 'Neutral' && (
          <span className={`ms-1 ${result.direction === 'Long' ? 'text-long' : 'text-short'}`}>{result.direction.toUpperCase()} · {t(`common.level.${result.riskLevel ?? 'Low'}`)}</span>
        )}
      </span>
      <span className={`max-w-[55%] truncate ${color}`} title={result.error}>{text}</span>
    </div>
  );
};

// Watchlist + timer: the dashboard analysis runs on each coin and opens signals on Hyperliquid
const AutoTraderCard: React.FC<AutoTraderCardProps> = ({ config, loggedIn, scanning, lastScan, onChange, onToggleRisk, onScanNow }) => {
  const { t, ttf } = useI18n();
  const [input, setInput] = useState('');
  const [pairs, setPairs] = useState<string[]>([]);

  useEffect(() => {
    fetchTradingPairs().then(setPairs).catch(() => {});
  }, []);

  const query = input.trim().toUpperCase();
  const suggestions = query ? pairs.filter((p) => p.startsWith(query) && !config.coins.includes(p)).slice(0, 30) : [];

  const addCoin = (raw: string) => {
    const pair = toPair(raw);
    if (!/^[A-Z0-9]{2,15}\/[A-Z0-9]{2,10}$/.test(pair) || config.coins.includes(pair) || config.coins.length >= MAX_COINS) return;
    onChange({ coins: [...config.coins, pair] });
    setInput('');
  };

  return (
    <Card
      title={t('hl.auto.title')}
      icon={<Bot className="h-4 w-4" />}
      hover={false}
      right={
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <span className={config.enabled ? 'text-long' : ''}>{config.enabled ? t('auto.on') : t('auto.off')}</span>
          <span className="relative inline-flex h-6 w-11 items-center">
            <input type="checkbox" checked={config.enabled} disabled={!loggedIn || config.coins.length === 0} onChange={(e) => onChange({ enabled: e.target.checked })} className="peer sr-only" />
            <span className="absolute inset-0 rounded-full bg-white/10 transition-colors peer-checked:bg-long/70 peer-disabled:opacity-50" />
            <span className="absolute start-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
          </span>
        </label>
      }
    >
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-slate-500">{t('hl.auto.description')}</p>

        <div className="flex flex-wrap gap-1.5">
          {config.coins.map((pair) => (
            <span key={pair} className="inline-flex items-center gap-1 rounded-lg border border-glow-cyan/30 bg-glow-cyan/10 px-2 py-0.5 font-mono text-[11px] text-glow-cyan">
              {pair}
              <button type="button" onClick={() => onChange({ coins: config.coins.filter((c) => c !== pair) })} className="text-glow-cyan/60 hover:text-white" aria-label={`Remove ${pair}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        {config.coins.length < MAX_COINS && (
          <CoinSearchInput value={input} suggestions={suggestions} placeholder={t('auto.addCoin', { count: config.coins.length, max: MAX_COINS })} onChange={setInput} onAdd={addCoin} disabled={config.enabled} />
        )}

        <div className="flex items-center gap-3">
          <select value={config.timeframe} disabled={config.enabled} onChange={(e) => onChange({ timeframe: e.target.value })} className="field min-w-0 flex-1 !py-1.5 text-xs">
            {TIMEFRAMES.map(({ value }) => <option key={value} value={value}>{ttf(value)}</option>)}
          </select>
          <span className="flex items-center gap-2 text-[11px] text-slate-400">
            {RISK_LEVELS.map((level) => (
              <label key={level} className={`flex cursor-pointer items-center gap-1 ${riskColor[level]}`}>
                <input type="checkbox" className="checkbox" checked={config.riskLevels.includes(level)} disabled={config.enabled} onChange={(e) => onToggleRisk(level, e.target.checked)} />
                {t(`common.level.${level}`)}
              </label>
            ))}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>{lastScan ? t('auto.lastScan', { time: formatTime(lastScan.at) }) : t('auto.noScan')}</span>
          <button type="button" onClick={onScanNow} disabled={!loggedIn || scanning || config.coins.length === 0} className="flex items-center gap-1 text-glow-cyan hover:text-white disabled:opacity-50">
            <Radar className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} /> {scanning ? t('auto.scanning') : t('auto.scanNow')}
          </button>
        </div>
        {lastScan && <div className="space-y-1">{lastScan.results.map((r) => <ScanRow key={r.coin} result={r} />)}</div>}
        {config.enabled && <p className="text-[10px] text-glow-amber">{t('hl.auto.keepOpen')}</p>}
      </div>
    </Card>
  );
};

export default AutoTraderCard;
