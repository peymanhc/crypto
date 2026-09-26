import { I18n } from '../../i18n';

// Turns the short error codes thrown by the Hyperliquid layer into readable text.
// Anything else (exchange messages) is shown as-is.
export const hlErrorText = (error: string, t: I18n['t']): string => {
  if (error.startsWith('not-listed:')) return t('hl.error.notListed', { coin: error.slice('not-listed:'.length) });
  // Exchange reply for an account that never deposited on the chosen network
  if (error.includes('Must deposit')) return t('hl.error.mustDeposit');
  if (error.includes('does not exist')) return t('hl.error.unknownAccount');
  switch (error) {
    case 'no-wallet':
      return t('hl.login.noWallet');
    case 'no-account':
      return t('hl.error.noAccount');
    case 'bad-address':
      return t('hl.error.badAddress');
    case 'bad-key':
      return t('hl.error.badKey');
    case 'size-too-small':
      return t('hl.error.sizeTooSmall');
    case 'not-filled':
      return t('hl.error.notFilled');
    case 'neutral':
      return t('hl.error.neutral');
    case 'no-session':
      return t('hl.error.noSession');
    case 'max-open':
      return t('hl.error.maxOpen');
    default:
      return error;
  }
};
