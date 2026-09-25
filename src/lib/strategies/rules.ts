// Every rule type: its editable settings and how it votes on a set of candles.
import { Candle, calculateSMA, calculateRSI, calculateIchimoku, analyzePriceAction } from '../analysis';
import { Rule, RuleType, RuleVote, Vote } from '../../types/strategy';
import { calculateMACD, calculateBollinger, calculateDonchian, last } from './indicators';

export interface ParamDef {
  key: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface RuleDef {
  params: ParamDef[];
}

const p = (key: string, def: number, min: number, max: number, step = 1): ParamDef => ({ key, default: def, min, max, step });

// The settings each rule type exposes in the Builder
export const RULE_DEFS: Record<RuleType, RuleDef> = {
  smaCross: { params: [p('fast', 10, 2, 200), p('slow', 50, 3, 400)] },
  priceVsSma: { params: [p('period', 20, 2, 400)] },
  rsiReversal: { params: [p('period', 14, 2, 100), p('oversold', 30, 1, 49), p('overbought', 70, 51, 99)] },
  rsiMomentum: { params: [p('period', 14, 2, 100), p('level', 50, 1, 99)] },
  ichimokuCloud: { params: [] },
  tenkanKijun: { params: [] },
  chikou: { params: [] },
  engulfing: { params: [] },
  macd: { params: [p('fast', 12, 2, 100), p('slow', 26, 3, 200), p('signal', 9, 2, 100)] },
  bollinger: { params: [p('period', 20, 5, 200), p('deviations', 2, 0.5, 4, 0.1)] },
  donchian: { params: [p('period', 20, 5, 200)] },
};

export const RULE_TYPES = Object.keys(RULE_DEFS) as RuleType[];

export const defaultParams = (type: RuleType): Record<string, number> =>
  Object.fromEntries(RULE_DEFS[type].params.map((param) => [param.key, param.default]));

export const newRule = (type: RuleType): Rule => ({
  id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  params: defaultParams(type),
  weight: 1,
});

// Turns "a above b" into a vote
const compare = (a: number, b: number): Vote => (a > b ? 1 : a < b ? -1 : 0);

const fmt = (n: number) => Number(n.toPrecision(5)).toString();

interface Outcome {
  vote: Vote;
  detail: string;
}

const NO_DATA: Outcome = { vote: 0, detail: '—' };

// One function per rule type. Each returns a vote and a short piece of evidence.
const evaluators: Record<RuleType, (rule: Rule, candles: Candle[], closes: number[]) => Outcome> = {
  smaCross: ({ params }, _c, closes) => {
    const fast = last(calculateSMA(closes, params.fast));
    const slow = last(calculateSMA(closes, params.slow));
    if (fast === undefined || slow === undefined) return NO_DATA;
    return { vote: compare(fast, slow), detail: `SMA${params.fast} ${fmt(fast)} vs SMA${params.slow} ${fmt(slow)}` };
  },
  priceVsSma: ({ params }, _c, closes) => {
    const sma = last(calculateSMA(closes, params.period));
    const price = last(closes);
    if (sma === undefined || price === undefined) return NO_DATA;
    return { vote: compare(price, sma), detail: `${fmt(price)} vs SMA${params.period} ${fmt(sma)}` };
  },
  rsiReversal: ({ params }, _c, closes) => {
    const rsi = calculateRSI(closes, params.period);
    if (rsi === null) return NO_DATA;
    const vote: Vote = rsi <= params.oversold ? 1 : rsi >= params.overbought ? -1 : 0;
    return { vote, detail: `RSI ${rsi.toFixed(0)}` };
  },
  rsiMomentum: ({ params }, _c, closes) => {
    const rsi = calculateRSI(closes, params.period);
    if (rsi === null) return NO_DATA;
    return { vote: compare(rsi, params.level), detail: `RSI ${rsi.toFixed(0)}` };
  },
  ichimokuCloud: (_r, candles, closes) => {
    const { cloudTop, cloudBottom } = calculateIchimoku(candles);
    const price = last(closes);
    if (cloudTop === null || cloudBottom === null || price === undefined) return NO_DATA;
    const vote: Vote = price > cloudTop ? 1 : price < cloudBottom ? -1 : 0;
    return { vote, detail: `${fmt(cloudBottom)} – ${fmt(cloudTop)}` };
  },
  tenkanKijun: (_r, candles) => {
    const { tenkanSen, kijunSen } = calculateIchimoku(candles);
    if (tenkanSen === null || kijunSen === null) return NO_DATA;
    return { vote: compare(tenkanSen, kijunSen), detail: `${fmt(tenkanSen)} vs ${fmt(kijunSen)}` };
  },
  chikou: (_r, candles, closes) => {
    const { chikouSpan } = calculateIchimoku(candles);
    const price = last(closes);
    if (chikouSpan === null || price === undefined) return NO_DATA;
    return { vote: compare(price, chikouSpan), detail: `${fmt(price)} vs ${fmt(chikouSpan)}` };
  },
  engulfing: (_r, candles) => {
    if (candles.length < 3) return NO_DATA;
    const pattern = analyzePriceAction(candles);
    const vote: Vote = pattern === 'Bullish Engulfing' ? 1 : pattern === 'Bearish Engulfing' ? -1 : 0;
    return { vote, detail: pattern };
  },
  macd: ({ params }, _c, closes) => {
    const macd = calculateMACD(closes, params.fast, params.slow, params.signal);
    if (!macd) return NO_DATA;
    return { vote: compare(macd.histogram, 0), detail: `hist ${fmt(macd.histogram)}` };
  },
  bollinger: ({ params }, _c, closes) => {
    const bands = calculateBollinger(closes, params.period, params.deviations);
    const price = last(closes);
    if (!bands || price === undefined) return NO_DATA;
    const vote: Vote = price <= bands.lower ? 1 : price >= bands.upper ? -1 : 0;
    return { vote, detail: `${fmt(bands.lower)} – ${fmt(bands.upper)}` };
  },
  donchian: ({ params }, candles, closes) => {
    const channel = calculateDonchian(candles, params.period);
    const price = last(closes);
    if (!channel || price === undefined) return NO_DATA;
    const vote: Vote = price > channel.high ? 1 : price < channel.low ? -1 : 0;
    return { vote, detail: `${fmt(channel.low)} – ${fmt(channel.high)}` };
  },
};

export const evaluateRule = (rule: Rule, candles: Candle[]): RuleVote => {
  const closes = candles.map((c) => c.close);
  const { vote, detail } = evaluators[rule.type](rule, candles, closes);
  return { ruleId: rule.id, type: rule.type, vote, weight: rule.weight, detail };
};
