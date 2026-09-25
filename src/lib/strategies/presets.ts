// The ready-made strategies of the Strategies tab. Each is just a small rule set.
import { PresetStrategy, Rule, RuleType } from '../../types/strategy';
import { defaultParams } from './rules';

const rule = (id: string, type: RuleType, params: Record<string, number> = {}): Rule => ({
  id,
  type,
  params: { ...defaultParams(type), ...params },
  weight: 1,
});

export const PRESETS: PresetStrategy[] = [
  { id: 'ichimoku', minScore: 2, rules: [rule('ichi-cloud', 'ichimokuCloud'), rule('ichi-tk', 'tenkanKijun'), rule('ichi-chikou', 'chikou')] },
  { id: 'smaTrend', minScore: 2, rules: [rule('sma-cross', 'smaCross', { fast: 10, slow: 50 }), rule('sma-price', 'priceVsSma', { period: 10 })] },
  { id: 'rsiReversal', minScore: 1, rules: [rule('rsi-rev', 'rsiReversal')] },
  { id: 'engulfing', minScore: 1, rules: [rule('engulf', 'engulfing')] },
  { id: 'macd', minScore: 1, rules: [rule('macd', 'macd')] },
  { id: 'bollinger', minScore: 1, rules: [rule('boll', 'bollinger')] },
  { id: 'donchian', minScore: 1, rules: [rule('donch', 'donchian')] },
  { id: 'trendMomentum', minScore: 2, rules: [rule('tm-sma', 'priceVsSma', { period: 50 }), rule('tm-rsi', 'rsiMomentum', { level: 50 })] },
];

export const PRESET_IDS = PRESETS.map((preset) => preset.id);
