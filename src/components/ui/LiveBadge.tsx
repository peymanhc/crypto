import { useI18n } from '../../i18n';

// Small pulsing "Live" pill in the header
const LiveBadge = () => {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-long/20 bg-long/10 px-2.5 py-1 text-[11px] font-medium text-long">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-long animate-ping-soft" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-long" />
      </span>
      {t('nav.live')}
    </span>
  );
};

export default LiveBadge;
