import { Recommendation } from './trading';

// +1 = long, -1 = short, 0 = no opinion
export type Vote = 1 | 0 | -1;

// One building block of a strategy. Each type reads the candles and casts a vote.
export type RuleType =
  | 'smaCross'
  | 'priceVsSma'
  | 'rsiReversal'
  | 'rsiMomentum'
  | 'ichimokuCloud'
  | 'tenkanKijun'
  | 'chikou'
  | 'engulfing'
  | 'macd'
  | 'bollinger'
  | 'donchian';

export interface Rule {
  id: string;
  type: RuleType;
  // Numeric settings such as { period: 14 }; the defaults live in RULE_DEFS
  params: Record<string, number>;
  // How much this rule's vote counts (1 = one vote)
  weight: number;
}

// A strategy the user built in the Builder tab
export interface CustomStrategy {
  id: string;
  name: string;
  rules: Rule[];
  // Net weighted votes needed before a direction is called (like the dashboard's 2 of 5)
  minScore: number;
  updatedAt: number;
}

// A ready-made strategy shown in the Strategies tab
export interface PresetStrategy {
  id: string;
  rules: Rule[];
  minScore: number;
}

// How one rule voted, for display
export interface RuleVote {
  ruleId: string;
  type: RuleType;
  vote: Vote;
  weight: number;
  // Short human-readable evidence, e.g. "RSI 27"
  detail: string;
}

export interface StrategyEvaluation {
  votes: RuleVote[];
  score: number;
  direction: Recommendation;
}

// Which engine produces the signals on the Strategies / Builder tabs (and in the backtest)
export type EngineId = 'dashboard' | 'simple' | 'pro';

export interface SimpleSelection {
  // Preset ids that are switched on
  enabled: string[];
  // Net strategy votes required before a direction is called
  minAgree: number;
}
