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

export type SignalSide = "BUY" | "SELL" | "NEUTRAL";

export interface AgentReport {
  name: string;
  side: SignalSide;
  confidence: number;
  reasoning: string;
  indicators?: Record<string, any>;
}

export interface FinalSignal {
  side: SignalSide;
  confidence: number;
  expirySuggestion: string;
  marketRegime: string;
  volatility: string;
  reasoning: string;
  agentReports: AgentReport[];
  timestamp: string;
}

export type Timeframe = "1m" | "5m" | "15m" | "1h";

export interface MarketState {
  pair: string;
  timeframe: Timeframe;
  mode: "Balance" | "Moderate" | "Pro";
}
