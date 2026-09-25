import React from 'react';
import { Recommendation, RiskLevel } from '../../types/trading';
import { TrendingUp, TrendingDown, MinusCircle, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { useI18n } from '../../i18n';

const directionBadge: Record<Recommendation, string> = {
  Long: 'border-long/30 bg-long/10 text-long',
  Short: 'border-short/30 bg-short/10 text-short',
  Neutral: 'border-white/10 bg-white/[0.05] text-slate-300',
};

const directionIcon: Record<Recommendation, React.ReactNode> = {
  Long: <TrendingUp className="h-3.5 w-3.5" />,
  Short: <TrendingDown className="h-3.5 w-3.5" />,
  Neutral: <MinusCircle className="h-3.5 w-3.5" />,
};

const riskBadge: Record<RiskLevel, string> = {
  Low: 'border-long/30 bg-long/10 text-long',
  Medium: 'border-glow-amber/30 bg-glow-amber/10 text-glow-amber',
  High: 'border-short/30 bg-short/10 text-short',
};

const riskIcon: Record<RiskLevel, React.ReactNode> = {
  Low: <ShieldCheck className="h-3.5 w-3.5" />,
  Medium: <ShieldAlert className="h-3.5 w-3.5" />,
  High: <ShieldX className="h-3.5 w-3.5" />,
};

const directionKey = { Long: 'common.long', Short: 'common.short', Neutral: 'common.neutral' } as const;

export const DirectionBadge: React.FC<{ direction: Recommendation }> = ({ direction }) => {
  const { t } = useI18n();
  return (
    <span className={`chip ${directionBadge[direction]}`}>
      {directionIcon[direction]}
      {t(directionKey[direction])}
    </span>
  );
};

export const RiskBadge: React.FC<{ level: RiskLevel }> = ({ level }) => {
  const { t } = useI18n();
  return (
    <span className={`chip ${riskBadge[level]}`}>
      {riskIcon[level]}
      {t(`common.risk.${level}`)}
    </span>
  );
};
