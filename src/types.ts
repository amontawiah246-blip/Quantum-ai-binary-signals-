/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalSide = "BUY" | "SELL" | "WAIT" | "NEUTRAL";

export interface AgentReport {
  name: string;
  side: SignalSide;
  confidence: number;
  reasoning: string;
  block?: boolean;
}

export interface VoteSummary {
  buys: number;
  sells: number;
  avgConfidence: number;
}

export interface FinalSignal {
  side: SignalSide;
  confidence: number;
  expirySuggestion: string;
  marketRegime: string;
  volatility: "Low" | "Moderate" | "High";
  reasoning: string;
  riskNote: string;
  confluenceScore?: string;
  agentReports: AgentReport[];
  voteSummary: VoteSummary;
  timestamp: string;
  // filled in on frontend for history
  pair?: string;
  timeframe?: string;
  userResult?: "WIN" | "LOSS" | "SKIP";
}

export type Timeframe = "1m" | "5m" | "15m" | "1h";

export interface MarketState {
  pair: string;
  timeframe: Timeframe;
  mode: "Balance" | "Moderate" | "Pro";
}
