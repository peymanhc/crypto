import { History } from 'lucide-react';
import { HlTradeLogEntry } from '../../types/hyperliquid';
import { formatDateTime, formatPrice } from '../../lib/format';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import { hlErrorText } from './errors';

const kindColor: Record<HlTradeLogEntry['kind'], string> = { open: 'text-long', close: 'text-glow-amber', error: 'text-short' };

// Everything this app did on Hyperliquid, newest first
const TradeLogCard: React.FC<{ entries: HlTradeLogEntry[] }> = ({ entries }) => {
  const { t } = useI18n();
  return (
    <Card title={t('hl.log.title')} icon={<History className="h-4 w-4" />} hover={false}>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500">{t('hl.log.empty')}</p>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.at} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
              <span className="min-w-0">
                <span className={`font-semibold ${kindColor[entry.kind]}`}>{t(`hl.log.${entry.kind}`)}</span>{' '}
                <span className="font-mono text-slate-200">{entry.coin}</span>
                {entry.direction && <span className={`ms-1 ${entry.direction === 'Long' ? 'text-long' : 'text-short'}`}>{entry.direction.toUpperCase()}</span>}
                {entry.size !== undefined && entry.price !== undefined && (
                  <span className="num ms-1 text-slate-500">{entry.size} @ {formatPrice(entry.price)}{entry.leverage ? ` · ${entry.leverage}x` : ''}</span>
                )}
                {entry.message && <span className="block truncate text-slate-500">{hlErrorText(entry.message, t)}</span>}
              </span>
              <span className="shrink-0 text-[10px] text-slate-500">{formatDateTime(entry.at)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TradeLogCard;
