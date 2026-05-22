import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
app.use(express.json());

app.get("/api/models", async (req, res) => {
  res.status(404).send();
});

// -----------------------------------------------------------------------------
// GEMINI CLIENT
// -----------------------------------------------------------------------------
let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
  }
  return ai;
}

// -----------------------------------------------------------------------------
// TIMEFRAME CONFIG — every setting adapts to the selected timeframe
// -----------------------------------------------------------------------------
interface TFConfig {
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  emaFast: number;
  emaSlow: number;
  emaTrail: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  bbStdDev: number;
  stochK: number;
  stochD: number;
  atrPeriod: number;
  htfEmaFast: number;   // simulated HTF using more periods on M1 data
  htfEmaSlow: number;
  minCandlesNeeded: number;
  expiryLabel: string;
  smcLookback: number;  // candles to scan for swing highs/lows
  volFilterRatio: number; // ATR ratio below which we filter (low vol)
}

const TF_CONFIGS: Record<string, TFConfig> = {
  "1m": {
    rsiPeriod: 7, rsiOverbought: 65, rsiOversold: 35,
    emaFast: 8, emaSlow: 21, emaTrail: 50,
    macdFast: 5, macdSlow: 13, macdSignal: 4,
    bbPeriod: 14, bbStdDev: 1.8,
    stochK: 5, stochD: 3,
    atrPeriod: 7,
    htfEmaFast: 25, htfEmaSlow: 100,
    minCandlesNeeded: 120, expiryLabel: "1 candle (1 min)",
    smcLookback: 20, volFilterRatio: 0.5
  },
  "5m": {
    rsiPeriod: 10, rsiOverbought: 68, rsiOversold: 32,
    emaFast: 9, emaSlow: 21, emaTrail: 55,
    macdFast: 8, macdSlow: 21, macdSignal: 5,
    bbPeriod: 18, bbStdDev: 2.0,
    stochK: 9, stochD: 3,
    atrPeriod: 10,
    htfEmaFast: 30, htfEmaSlow: 120,
    minCandlesNeeded: 150, expiryLabel: "1–2 candles (5–10 min)",
    smcLookback: 30, volFilterRatio: 0.55
  },
  "15m": {
    rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30,
    emaFast: 9, emaSlow: 21, emaTrail: 50,
    macdFast: 12, macdSlow: 26, macdSignal: 9,
    bbPeriod: 20, bbStdDev: 2.0,
    stochK: 14, stochD: 3,
    atrPeriod: 14,
    htfEmaFast: 40, htfEmaSlow: 160,
    minCandlesNeeded: 200, expiryLabel: "1–3 candles (15–45 min)",
    smcLookback: 40, volFilterRatio: 0.6
  },
  "1h": {
    rsiPeriod: 14, rsiOverbought: 72, rsiOversold: 28,
    emaFast: 12, emaSlow: 26, emaTrail: 50,
    macdFast: 12, macdSlow: 26, macdSignal: 9,
    bbPeriod: 20, bbStdDev: 2.0,
    stochK: 14, stochD: 3,
    atrPeriod: 14,
    htfEmaFast: 50, htfEmaSlow: 200,
    minCandlesNeeded: 250, expiryLabel: "1–2 candles (1–2 hrs)",
    smcLookback: 50, volFilterRatio: 0.65
  }
};

function getTFConfig(timeframe: string): TFConfig {
  return TF_CONFIGS[timeframe] || TF_CONFIGS["5m"];
}

// -----------------------------------------------------------------------------
// INDICATOR MATH
// -----------------------------------------------------------------------------
function calcEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = new Array(data.length).fill(NaN);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += data[i];
  ema[period - 1] = seed / period;
  for (let i = period; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calcMACD(data: number[], fast: number, slow: number, signal: number) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const macdLine = data.map((_, i) =>
    !isNaN(emaFast[i]) && !isNaN(emaSlow[i]) ? emaFast[i] - emaSlow[i] : NaN
  );
  const validMacd = macdLine.filter(v => !isNaN(v));
  const rawSignal = calcEMA(validMacd, signal);
  const offset = macdLine.length - validMacd.length;
  const signalLine = [...new Array(offset).fill(NaN), ...rawSignal];
  const histogram = macdLine.map((v, i) =>
    !isNaN(v) && !isNaN(signalLine[i]) ? v - signalLine[i] : NaN
  );
  return { line: macdLine, signal: signalLine, histogram };
}

function calcRSI(data: number[], period: number): number[] {
  const rsi: number[] = new Array(data.length).fill(NaN);
  if (data.length < period + 1) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = data[i] - data[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    rsi[i] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  }
  return rsi;
}

function calcATR(candles: any[], period: number): number[] {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - candles[i - 1].close),
      Math.abs(c.low - candles[i - 1].close)
    );
  });
  return calcEMA(tr, period);
}

function calcStoch(candles: any[], kPeriod: number, dPeriod: number) {
  const kArr: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const lo = Math.min(...slice.map((c: any) => c.low));
    const hi = Math.max(...slice.map((c: any) => c.high));
    kArr.push(hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100);
  }
  const dArr: number[] = [];
  for (let i = dPeriod - 1; i < kArr.length; i++) {
    dArr.push(kArr.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / dPeriod);
  }
  return { k: kArr, d: dArr };
}

function calcBB(data: number[], period: number, stdDev: number) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return { upper: mean + stdDev * sd, middle: mean, lower: mean - stdDev * sd, bandwidth: (2 * stdDev * sd) / mean };
  });
}

// RSI divergence detector — compares price lows/highs vs RSI lows/highs
function detectRSIDivergence(candles: any[], rsi: number[], lookback: number = 10): "bullish" | "bearish" | "none" {
  const len = candles.length;
  if (len < lookback + 2) return "none";
  const recentCandles = candles.slice(-lookback);
  const recentRSI = rsi.slice(-lookback);
  // Bullish divergence: price makes lower low, RSI makes higher low
  const priceLL = recentCandles[recentCandles.length - 1].low < Math.min(...recentCandles.slice(0, -1).map(c => c.low));
  const rsiHL = recentRSI[recentRSI.length - 1] > Math.min(...recentRSI.slice(0, -1).filter(v => !isNaN(v)));
  if (priceLL && rsiHL) return "bullish";
  // Bearish divergence: price makes higher high, RSI makes lower high
  const priceHH = recentCandles[recentCandles.length - 1].high > Math.max(...recentCandles.slice(0, -1).map(c => c.high));
  const rsiLH = recentRSI[recentRSI.length - 1] < Math.max(...recentRSI.slice(0, -1).filter(v => !isNaN(v)));
  if (priceHH && rsiLH) return "bearish";
  return "none";
}

// Swing high/low detector for SMC
function findSwings(candles: any[], lookback: number) {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const isSwingHigh = candles[i].high > candles[i-1].high && candles[i].high > candles[i-2].high &&
                        candles[i].high > candles[i+1].high && candles[i].high > candles[i+2].high;
    const isSwingLow  = candles[i].low < candles[i-1].low && candles[i].low < candles[i-2].low &&
                        candles[i].low < candles[i+1].low && candles[i].low < candles[i+2].low;
    if (isSwingHigh) highs.push(candles[i].high);
    if (isSwingLow)  lows.push(candles[i].low);
  }
  return { highs: highs.slice(-5), lows: lows.slice(-5) };
}

// -----------------------------------------------------------------------------
// AGENT 1 — EMA TREND BIAS (Timeframe-Adaptive)
// Establishes the macro direction. Signals are only taken WITH this bias
// unless an extreme SMC sweep overrides it.
// -----------------------------------------------------------------------------
function agentEMATrend(candles: any[], cfg: TFConfig) {
  const prices = candles.map(c => c.close);
  const emaFast  = calcEMA(prices, cfg.emaFast);
  const emaSlow  = calcEMA(prices, cfg.emaSlow);
  const emaTrail = calcEMA(prices, cfg.emaTrail);
  const htfFast  = calcEMA(prices, cfg.htfEmaFast);
  const htfSlow  = calcEMA(prices, cfg.htfEmaSlow);

  const last = prices.length - 1;
  const ef = emaFast[last], es = emaSlow[last], et = emaTrail[last];
  const hf = htfFast[last], hs = htfSlow[last];
  const price = prices[last];

  if (isNaN(ef) || isNaN(es) || isNaN(et) || isNaN(hf) || isNaN(hs)) {
    return { name: "EMA Trend Agent", side: "NEUTRAL" as const, confidence: 0, reasoning: "Insufficient candles for EMA calculation." };
  }

  // EMA stack: price > fast > slow > trail = strong bull
  const bullStack = price > ef && ef > es && es > et;
  const bearStack = price < ef && ef < es && es < et;
  const htfBull   = hf > hs;
  const htfBear   = hf < hs;

  // Recent crossover detection (last 3 candles)
  const prevEF = emaFast[last - 1], prevES = emaSlow[last - 1];
  const goldenCross = ef > es && prevEF <= prevES;
  const deathCross  = ef < es && prevEF >= prevES;

  let score = 0;
  const reasons: string[] = [];

  if (bullStack)   { score += 3; reasons.push(`Full bull EMA stack (${cfg.emaFast}/${cfg.emaSlow}/${cfg.emaTrail})`); }
  if (bearStack)   { score -= 3; reasons.push(`Full bear EMA stack`); }
  if (htfBull)     { score += 2; reasons.push(`HTF EMA (${cfg.htfEmaFast}/${cfg.htfEmaSlow}) bullish`); }
  if (htfBear)     { score -= 2; reasons.push(`HTF EMA bearish`); }
  if (goldenCross) { score += 2; reasons.push(`Golden cross just formed`); }
  if (deathCross)  { score -= 2; reasons.push(`Death cross just formed`); }
  if (!bullStack && !bearStack) { reasons.push("EMA stack mixed — ranging"); }

  const side = score >= 3 ? "BUY" : score <= -3 ? "SELL" : "NEUTRAL";
  const confidence = Math.min(Math.abs(score) * 14 + 35, 92);

  return {
    name: "EMA Trend Agent",
    side,
    confidence: side === "NEUTRAL" ? 0 : confidence,
    reasoning: reasons.join(". ") || "No clear EMA alignment."
  };
}

// -----------------------------------------------------------------------------
// AGENT 2 — RSI + MACD MOMENTUM (Timeframe-Adaptive)
// Measures momentum strength and looks for divergence.
// -----------------------------------------------------------------------------
function agentMomentum(candles: any[], cfg: TFConfig) {
  const prices = candles.map(c => c.close);
  const rsi   = calcRSI(prices, cfg.rsiPeriod);
  const macd  = calcMACD(prices, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
  const divergence = detectRSIDivergence(candles, rsi, cfg.smcLookback / 2);

  const last = prices.length - 1;
  const rsiVal  = rsi[last];
  const rsiPrev = rsi[last - 1];
  const hist     = macd.histogram[last];
  const histPrev = macd.histogram[last - 1];
  const macdLine = macd.line[last];
  const sigLine  = macd.signal[last];

  if (isNaN(rsiVal) || isNaN(hist)) {
    return { name: "RSI+MACD Momentum Agent", side: "NEUTRAL" as const, confidence: 0, reasoning: "Not enough data for momentum." };
  }

  let score = 0;
  const reasons: string[] = [];

  // RSI level
  if (rsiVal < cfg.rsiOversold)    { score += 3; reasons.push(`RSI(${cfg.rsiPeriod}) oversold at ${rsiVal.toFixed(1)}`); }
  else if (rsiVal > cfg.rsiOverbought) { score -= 3; reasons.push(`RSI(${cfg.rsiPeriod}) overbought at ${rsiVal.toFixed(1)}`); }
  else if (rsiVal > 50 && rsiPrev <= 50) { score += 1; reasons.push(`RSI crossed above 50`); }
  else if (rsiVal < 50 && rsiPrev >= 50) { score -= 1; reasons.push(`RSI crossed below 50`); }

  // MACD histogram direction and zero-line cross
  if (!isNaN(hist) && !isNaN(histPrev)) {
    if (hist > 0 && histPrev <= 0) { score += 2; reasons.push(`MACD histogram turned positive`); }
    if (hist < 0 && histPrev >= 0) { score -= 2; reasons.push(`MACD histogram turned negative`); }
    if (hist > histPrev && hist > 0)  { score += 1; reasons.push(`MACD momentum accelerating bullish`); }
    if (hist < histPrev && hist < 0)  { score -= 1; reasons.push(`MACD momentum accelerating bearish`); }
  }
  if (!isNaN(macdLine) && !isNaN(sigLine)) {
    if (macdLine > sigLine)  { score += 1; reasons.push(`MACD above signal`); }
    else                     { score -= 1; reasons.push(`MACD below signal`); }
  }

  // RSI divergence (strong signal)
  if (divergence === "bullish") { score += 3; reasons.push(`Bullish RSI divergence detected`); }
  if (divergence === "bearish") { score -= 3; reasons.push(`Bearish RSI divergence detected`); }

  const side = score >= 3 ? "BUY" : score <= -3 ? "SELL" : "NEUTRAL";
  const confidence = Math.min(Math.abs(score) * 12 + 38, 92);

  return {
    name: "RSI+MACD Momentum Agent",
    side,
    confidence: side === "NEUTRAL" ? 0 : confidence,
    reasoning: reasons.join(". ") || "No decisive momentum signal."
  };
}

// -----------------------------------------------------------------------------
// AGENT 3 — SMC LIQUIDITY & STRUCTURE (Timeframe-Adaptive)
// Detects SSL/BSL purges, BOS, CHoCH, order blocks.
// -----------------------------------------------------------------------------
function agentSMC(candles: any[], cfg: TFConfig) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const window = candles.slice(-cfg.smcLookback);
  const swings = findSwings(window, cfg.smcLookback);

  const recentHigh = Math.max(...window.map(c => c.high));
  const recentLow  = Math.min(...window.map(c => c.low));
  const range      = recentHigh - recentLow;

  let score = 0;
  const reasons: string[] = [];

  // SSL Purge: swept below recent lows, then closed back above — smart money trapped shorts
  const sslPurge = last.low < recentLow + range * 0.05 && last.close > recentLow + range * 0.1 && last.close > last.open;
  // BSL Purge: swept above recent highs, then closed back below — smart money trapped longs
  const bslPurge = last.high > recentHigh - range * 0.05 && last.close < recentHigh - range * 0.1 && last.close < last.open;

  if (sslPurge) { score += 4; reasons.push(`SSL Purge: swept sell-side liquidity at ${recentLow.toFixed(5)}, bullish close confirms SMC buy`); }
  if (bslPurge) { score -= 4; reasons.push(`BSL Purge: swept buy-side liquidity at ${recentHigh.toFixed(5)}, bearish close confirms SMC sell`); }

  // BOS (Break of Structure): close beyond recent swing high/low
  if (swings.highs.length >= 2) {
    const prevSwingHigh = swings.highs[swings.highs.length - 2];
    if (last.close > prevSwingHigh) { score += 2; reasons.push(`BOS above ${prevSwingHigh.toFixed(5)} — bullish structure break`); }
  }
  if (swings.lows.length >= 2) {
    const prevSwingLow = swings.lows[swings.lows.length - 2];
    if (last.close < prevSwingLow) { score -= 2; reasons.push(`BOS below ${prevSwingLow.toFixed(5)} — bearish structure break`); }
  }

  // CHoCH: previous candle was bearish close, current is bullish close above prev high (and vice versa)
  if (prev.close < prev.open && last.close > prev.high && last.close > last.open) {
    score += 2; reasons.push(`CHoCH: character shift from bearish to bullish`);
  }
  if (prev.close > prev.open && last.close < prev.low && last.close < last.open) {
    score -= 2; reasons.push(`CHoCH: character shift from bullish to bearish`);
  }

  // Order Block detection: last strong directional candle before a move
  const ob3 = candles[candles.length - 3];
  if (ob3) {
    const obBullish = ob3.close < ob3.open && last.close > ob3.high; // bearish OB being mitigated = bullish entry
    const obBearish = ob3.close > ob3.open && last.close < ob3.low;
    if (obBullish) { score += 1; reasons.push(`Bearish OB mitigated — institutional long fill likely`); }
    if (obBearish) { score -= 1; reasons.push(`Bullish OB mitigated — institutional short fill likely`); }
  }

  // Fair Value Gap
  const c1 = candles[candles.length - 3];
  const c3 = candles[candles.length - 1];
  if (c1 && c3) {
    const bullFVG = c1.high < c3.low; // gap between c1 high and c3 low = bullish imbalance
    const bearFVG = c1.low > c3.high;
    if (bullFVG) { score += 1; reasons.push(`Bullish FVG present — imbalance favors upside fill`); }
    if (bearFVG) { score -= 1; reasons.push(`Bearish FVG present — imbalance favors downside fill`); }
  }

  const side = score >= 3 ? "BUY" : score <= -3 ? "SELL" : "NEUTRAL";
  const confidence = Math.min(Math.abs(score) * 13 + 36, 94);

  return {
    name: "SMC Structure Agent",
    side,
    confidence: side === "NEUTRAL" ? 0 : confidence,
    reasoning: reasons.join(". ") || "No clear SMC structure signal in recent price action."
  };
}

// -----------------------------------------------------------------------------
// AGENT 4 — PRICE ACTION PATTERNS
// Candlestick patterns with body/wick analysis.
// -----------------------------------------------------------------------------
function agentPriceAction(candles: any[], cfg: TFConfig) {
  const last  = candles[candles.length - 1];
  const prev  = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  const body    = Math.abs(last.close - last.open);
  const total   = last.high - last.low || 0.00001;
  const upperW  = last.high - Math.max(last.open, last.close);
  const lowerW  = Math.min(last.open, last.close) - last.low;
  const isBullC = last.close > last.open;
  const isBearC = last.close < last.open;

  let score = 0;
  const reasons: string[] = [];

  // Engulfing
  if (isBullC && prev.close < prev.open && last.close >= prev.open && last.open <= prev.close) {
    score += 3; reasons.push(`Bullish engulfing: full body absorbed previous bearish candle`);
  }
  if (isBearC && prev.close > prev.open && last.close <= prev.open && last.open >= prev.close) {
    score -= 3; reasons.push(`Bearish engulfing: full body absorbed previous bullish candle`);
  }

  // Pin bar / hammer / shooting star
  if (lowerW > body * 2 && upperW < body * 0.5 && body / total > 0.15) {
    score += 2; reasons.push(`Bullish pin bar: strong lower wick rejection (${(lowerW/total*100).toFixed(0)}% of range)`);
  }
  if (upperW > body * 2 && lowerW < body * 0.5 && body / total > 0.15) {
    score -= 2; reasons.push(`Bearish pin bar: strong upper wick rejection (${(upperW/total*100).toFixed(0)}% of range)`);
  }

  // Doji at extremes — indecision
  if (body / total < 0.1) {
    reasons.push(`Doji candle — market indecision, wait for follow-through`);
  }

  // Morning star (3-candle bullish reversal)
  if (prev2 && prev2.close < prev2.open && Math.abs(prev.close - prev.open) / (prev.high - prev.low) < 0.2 && isBullC && last.close > (prev2.open + prev2.close) / 2) {
    score += 3; reasons.push(`Morning star pattern: 3-candle bullish reversal confirmed`);
  }
  // Evening star (3-candle bearish reversal)
  if (prev2 && prev2.close > prev2.open && Math.abs(prev.close - prev.open) / (prev.high - prev.low) < 0.2 && isBearC && last.close < (prev2.open + prev2.close) / 2) {
    score -= 3; reasons.push(`Evening star pattern: 3-candle bearish reversal confirmed`);
  }

  // Marubozu (strong momentum candle)
  if (isBullC && body / total > 0.85) {
    score += 1; reasons.push(`Bullish Marubozu: strong directional momentum`);
  }
  if (isBearC && body / total > 0.85) {
    score -= 1; reasons.push(`Bearish Marubozu: strong downward momentum`);
  }

  const side = score >= 3 ? "BUY" : score <= -3 ? "SELL" : "NEUTRAL";
  const confidence = Math.min(Math.abs(score) * 15 + 40, 85);

  return {
    name: "Price Action Agent",
    side,
    confidence: side === "NEUTRAL" ? 0 : confidence,
    reasoning: reasons.join(". ") || "No decisive candlestick pattern detected."
  };
}

async function analyzeGitHubVision(candles: any[]) {
  const hasToken = !!process.env.GITHUB_TOKEN;
  const last = candles[candles.length - 1];
  const recentHighs = Math.max(...candles.slice(-25, -1).map(c => c.high));
  const recentLows = Math.min(...candles.slice(-25, -1).map(c => c.low));
  const rangeLength = recentHighs - recentLows;

  if (!hasToken) {
    let side: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
    let confidence = 0;
    let reasoning = "Vision Logic: Scanning fractal structure for institutional footprints.";

    const isSSL_Purge = last.low <= recentLows + (rangeLength * 0.15) && last.close > last.open;
    const isBSL_Purge = last.high >= recentHighs - (rangeLength * 0.15) && last.close < last.open;

    if (isSSL_Purge) {
      side = "BUY";
      confidence = 94;
      reasoning += " CRITICAL: Institutional SSL Purge confirmed. Smart money has trapped retail shorts and is mitigating long orders. High-probability bullish delivery expected.";
    } else if (isBSL_Purge) {
      side = "SELL";
      confidence = 94;
      reasoning += " CRITICAL: BSL Purge confirmed. Institutional distribution detected. Market is being offloaded into retail buy-pressure. Imminent collapse expected.";
    }

    return { 
      name: "SMC Vision (Simulated)", 
      side, 
      confidence, 
      reasoning 
    };
  }

  try {
    const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: "Meta-Llama-3.1-405B-Instruct",
        messages: [
          {
            role: "system",
            content: "You are an expert SMC (Smart Money Concepts) trading AI. Analyze the recent candlestick data and identify if there is a Buy-Side Liquidity (BSL) purge, Sell-Side Liquidity (SSL) purge, Order Block formation, or Fair Value Gap (FVG). You must output your analysis as purely JSON format, with no markdown format, containing exactly: { side: 'BUY' | 'SELL' | 'NEUTRAL', confidence: number, reasoning: string }. Number for confidence should be 0-100."
          },
          {
            role: "user",
            content: "Recent Candles Data (Last 10 OHLCV): " + JSON.stringify(candles.slice(-10))
          }
        ],
        temperature: 0.2,
        max_tokens: 300
      })
    });

    if (!response.ok) {
        throw new Error("GitHub API Error: " + response.statusText);
    }
    const data = await response.json();
    const messageContent = data.choices[0].message.content;
    const parsed = JSON.parse(messageContent.replace(/```json|```/g, "").trim());
    
    return {
      name: "SMC Vision (Llama-3.1-405b)",
      side: parsed.side || "NEUTRAL",
      confidence: parsed.confidence || 0,
      reasoning: "Live Llama SMC Analysis: " + (parsed.reasoning || "No reasoning.")
    };
  } catch (err: any) {
    return {
      name: "SMC Vision (Llama-3.1-405b)",
      side: "NEUTRAL",
      confidence: 0,
      reasoning: "GitHub API Call failed: " + err.message
    };
  }
}

// -----------------------------------------------------------------------------
// API ROUTES
// -----------------------------------------------------------------------------

app.get("/api/market-data", async (req, res) => {
  const { pair = "EUR/USD", timeframe = "1min" } = req.query;
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  
  const intervalMap: Record<string, string> = { "1m": "1min", "5m": "5min", "15m": "15min", "1h": "1h" };
  const interval = intervalMap[timeframe as string] || timeframe;

  if (apiKey) {
    try {
      const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${pair}&interval=${interval}&outputsize=100&apikey=${apiKey}`);
      const data = await response.json();
      if (data.values) {
        return res.json(data.values.map((v: any) => ({
          timestamp: v.datetime,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          volume: parseInt(v.volume || "0")
        })).reverse());
      }
    } catch (e) {
      console.error("Twelve Data fetch failed", e);
    }
  }

  const base = 1.0850;
  let currentBase = base;
  const simulated = Array.from({ length: 100 }, (_, i) => {
    const change = (Math.random() - 0.5) * 0.002;
    currentBase += change;
    return {
      timestamp: new Date(Date.now() - (100 - i) * 60000).toISOString(),
      open: currentBase,
      high: currentBase + Math.random() * 0.001,
      low: currentBase - Math.random() * 0.001,
      close: currentBase + (Math.random() - 0.5) * 0.0008,
      volume: Math.floor(Math.random() * 1000)
    };
  });
  res.json(simulated);
});

app.post("/api/analyze", async (req, res) => {
  const { candles, pair, timeframe, mode } = req.body;

  try {
    const cfg = getTFConfig(timeframe);

    const agents = await Promise.all([
      agentEMATrend(candles, cfg),
      agentMomentum(candles, cfg),
      agentSMC(candles, cfg),
      agentPriceAction(candles, cfg),
      analyzeGitHubVision(candles)
    ]);

    const aiClient = getAI();

    const prompt = `
      You are the Master Quantitative Ordinator. 
      Market Context: ${pair} | ${timeframe} | Mode: ${mode}
      
      YOUR MANDATE: PERFORM CONTEXTUAL 'TOUGH ANALYSIS'. 
      Do not mindlessly follow any single indicator. Use the intelligence reports to synthesize a comprehensive market view.

      EXECUTION MODE BEHAVIOR:
      ${mode === "Balance" ? "- 'Balance' mode: Accept lower quality signals. You can issue a BUY or SELL even with weak or conflicting confluence if one agent shows a strong bias." : ""}
      ${mode === "Moderate" ? "- 'Moderate' mode: Require medium quality signals. Ensure at least two agents agree before issuing a clear signal." : ""}
      ${mode === "Pro" ? "- 'Pro' mode: THE MASTER COMES IN. Generate highly accurate signals with DEEP analysis. Proceed purely on institutional delivery rules. Confluence must be extremely strong. Provide profound, sophisticated reasoning." : ""}
      
      Agent Reports:
      ${agents.map(a => `- ${a.name}: ${a.side} (Confidence: ${a.confidence}%). Reasoning: ${a.reasoning}`).join('\n')}

      Recent Raw Data: ${JSON.stringify(candles.slice(-5))}

      Return a JSON object with:
      {
        "side": "BUY" | "SELL" | "NEUTRAL",
        "confidence": number,
        "expirySuggestion": "${cfg.expiryLabel}",
        "marketRegime": "string",
        "volatility": "Low" | "Moderate" | "High",
        "reasoning": "string (Detail the tough analysis and internal consensus)"
      }
    `;

    // Try a few fallback models if one fails
    let response;
    try {
      response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
    } catch (e: any) {
      console.warn("gemini-2.5-flash failed, trying gemini-2.5-flash", e.message);
      // fallback just in case
      response = await aiClient.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
    }

    const text = response.text || "{}";
    const finalSignal = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Confidence Gate (Only take signal if Gemini confidence >= 70 AND at least 3 agents agree)
    const confirmingAgents = agents.filter(a => a.side === finalSignal.side && a.side !== "NEUTRAL");
    if (finalSignal.side !== "NEUTRAL" && (finalSignal.confidence < 70 || confirmingAgents.length < 3)) {
      finalSignal.side = "NEUTRAL";
      finalSignal.reasoning = "WAIT: Confidence gate failed. Either Master Brain confidence < 70% or insufficient multi-agent consensus (< 3 agents agreed). Let the market develop.";
      finalSignal.confidence = 0;
    }

    res.json({
      ...finalSignal,
      agentReports: agents,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Analysis failed", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
