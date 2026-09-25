import { Info } from 'lucide-react';
import Card from '../ui/Card';
import { useI18n } from '../../i18n';

// Short honest note on what the simulation assumes
const HowItWorksCard = () => {
  const { t } = useI18n();
  return (
    <Card hover={false} delay={0.1}>
      <div className="flex gap-2.5 text-[11px] leading-relaxed text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-glow-cyan" />
        <p>{t('bt.howItWorks')}</p>
      </div>
    </Card>
  );
};

export default HowItWorksCard;
