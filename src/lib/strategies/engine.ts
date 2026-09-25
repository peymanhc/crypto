// Turns a strategy (or the user's engine choice) into a trade plan.
//
// Only the DIRECTION comes from the strategy. Entry, stop, take profits, leverage
// and risk level are always computed by the dashboard's own buildTradePlan, so
// every signal has the same shape and the same Telegram text as before.
import { Candle, Analysis, analyzeCandles, buildTradePlan } from '../analysis';
import { Recommendation, TradePlan } from '../../types/trading';
import { CustomStrategy, EngineId, PresetStrategy, Rule, RuleVote, SimpleSelection, StrategyEvaluation } from '../../types/strategy';
import { evaluateRule } from './rules';
import { PRESETS } from './presets';

// Weighted sum of the rule votes, and the direction once it clears `minScore`
export const evaluateRules = (rules: Rule[], minScore: number, candles: Candle[]): StrategyEvaluation => {
  const votes: RuleVote[] = rules.map((rule) => evaluateRule(rule, candles));
  const score = votes.reduce((sum, v) => sum + v.vote * v.weight, 0);
  const threshold = Math.max(1, minScore);
  const direction: Recommendation = score >= threshold ? 'Long' : score <= -threshold ? 'Short' : 'Neutral';
  return { votes, score, direction };
};

export const evaluateStrategy = (strategy: CustomStrategy | PresetStrategy, candles: Candle[]): StrategyEvaluation =>
  evaluateRules(strategy.rules, strategy.minScore, candles);

// One line per strategy / rule that voted, for the signal card
export interface Reason {
  label: string;
  direction: Recommendation;
  detail?: string;
}

export interface EngineResult {
  plan: TradePlan;
  direction: Recommendation;
  reasons: Reason[];
  // Present only for the dashboard engine (its RSI / overextension warning)
  caution: string | null;
}

// Builds the plan with the dashboard's own maths, swapping in our direction and reasons
const planFor = (candles: Candle[], direction: Recommendation, reasons: Reason[]): TradePlan => {
  const base: Analysis = analyzeCandles(candles);
  const analysis: Analysis = {
    ...base,
    recommendation: direction,
    bullishPoints: reasons.filter((r) => r.direction === 'Long').map((r) => r.label),
    bearishPoints: reasons.filter((r) => r.direction === 'Short').map((r) => r.label),
    caution: null,
  };
  return buildTradePlan(analysis);
};

const voteToDirection = (vote: number): Recommendation => (vote > 0 ? 'Long' : vote < 0 ? 'Short' : 'Neutral');

// Engine 1: exactly what the dashboard shows
export const runDashboardEngine = (candles: Candle[]): EngineResult => {
  const analysis = analyzeCandles(candles);
  const reasons: Reason[] = [
    ...analysis.bullishPoints.map((label) => ({ label, direction: 'Long' as Recommendation })),
    ...analysis.bearishPoints.map((label) => ({ label, direction: 'Short' as Recommendation })),
  ];
  return { plan: buildTradePlan(analysis), direction: analysis.recommendation, reasons, caution: analysis.caution };
};

// Engine 2: every switched-on preset votes; the net vote must reach `minAgree`
export const runSimpleEngine = (selection: SimpleSelection, candles: Candle[]): EngineResult => {
  const active = PRESETS.filter((preset) => selection.enabled.includes(preset.id));
  const reasons: Reason[] = active
    .map((preset) => ({ preset, evaluation: evaluateStrategy(preset, candles) }))
    .filter(({ evaluation }) => evaluation.direction !== 'Neutral')
    .map(({ preset, evaluation }) => ({ label: preset.id, direction: evaluation.direction, detail: `${evaluation.score > 0 ? '+' : ''}${evaluation.score}` }));
  const net = reasons.reduce((sum, r) => sum + (r.direction === 'Long' ? 1 : -1), 0);
  const direction = Math.abs(net) >= Math.max(1, selection.minAgree) ? voteToDirection(net) : 'Neutral';
  return { plan: planFor(candles, direction, reasons), direction, reasons, caution: null };
};

// Engine 3: the user's own rule set from the Builder
export const runProEngine = (strategy: CustomStrategy | null, candles: Candle[]): EngineResult => {
  if (!strategy || strategy.rules.length === 0) {
    return { plan: planFor(candles, 'Neutral', []), direction: 'Neutral', reasons: [], caution: null };
  }
  const evaluation = evaluateStrategy(strategy, candles);
  const reasons: Reason[] = evaluation.votes
    .filter((v) => v.vote !== 0)
    .map((v) => ({ label: v.type, direction: voteToDirection(v.vote), detail: v.detail }));
  return { plan: planFor(candles, evaluation.direction, reasons), direction: evaluation.direction, reasons, caution: null };
};

export interface EngineInputs {
  engine: EngineId;
  simple: SimpleSelection;
  pro: CustomStrategy | null;
}

// Runs whichever engine the user picked
export const runEngine = ({ engine, simple, pro }: EngineInputs, candles: Candle[]): EngineResult => {
  if (engine === 'simple') return runSimpleEngine(simple, candles);
  if (engine === 'pro') return runProEngine(pro, candles);
  return runDashboardEngine(candles);
};

// The plan only (what the backtest needs); null when the engine says Neutral
export const signalFor = (inputs: EngineInputs, candles: Candle[]): TradePlan | null => {
  const { plan } = runEngine(inputs, candles);
  return plan.direction === 'Neutral' ? null : plan;
};
