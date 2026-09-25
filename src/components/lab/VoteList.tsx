import { Reason } from '../../lib/strategies/engine';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';
import { DirectionBadge } from '../ui/Badge';

interface VoteListProps {
  reasons: Reason[];
  caution: string | null;
}

// Preset ids and rule types have translations; dashboard reasons are free text
const labelOf = (label: string, t: ReturnType<typeof useI18n>['t']): string => {
  for (const prefix of ['preset', 'rule']) {
    const key = `${prefix}.${label}` as TranslationKey;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return label;
};

// Who voted which way in the last analysis
const VoteList: React.FC<VoteListProps> = ({ reasons, caution }) => {
  const { t } = useI18n();
  if (reasons.length === 0 && !caution) return <p className="text-xs text-slate-500">{t('lab.noVotes')}</p>;
  return (
    <div className="space-y-1.5">
      {reasons.map((reason, i) => (
        <div key={`${reason.label}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs">
          <span className="min-w-0">
            <span className="block truncate text-slate-200">{labelOf(reason.label, t)}</span>
            {reason.detail && <span className="num block text-[10px] text-slate-500">{reason.detail}</span>}
          </span>
          <DirectionBadge direction={reason.direction} />
        </div>
      ))}
      {caution && <p dir="ltr" className="rounded-lg border border-glow-amber/30 bg-glow-amber/10 px-2.5 py-1.5 text-start text-[11px] text-glow-amber">{caution}</p>}
    </div>
  );
};

export default VoteList;
