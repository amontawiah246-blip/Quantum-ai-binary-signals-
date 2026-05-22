/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { 
  Zap, 
  Settings, 
  BarChart3, 
  RefreshCcw, 
  LayoutDashboard, 
  Info,
  ChevronDown,
  Globe,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SignalCard } from "./components/SignalCard";
import { AgentReports } from "./components/AgentReports";
import { MarketChart } from "./components/MarketChart";
import { Candle, FinalSignal, MarketState, Timeframe } from "./types";
import { cn } from "./lib/utils";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "BTC/USD", "ETH/USD"];
const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h"];
const MODES = ["Balance", "Moderate", "Pro"] as const;

export default function App() {
  const [marketState, setMarketState] = useState<MarketState>({
    pair: PAIRS[0],
    timeframe: "1m",
    mode: "Balance"
  });
  
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signal, setSignal] = useState<FinalSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMarketData = useCallback(async () => {
    try {
      const resp = await fetch(`/api/market-data?pair=${marketState.pair}&timeframe=${marketState.timeframe}`);
      const data = await resp.json();
      setCandles(data);
      return data;
    } catch (e) {
      console.error("Failed to fetch market data", e);
      return [];
    }
  }, [marketState.pair, marketState.timeframe]);

  const getSignal = async () => {
    setLoading(true);
    try {
      const currentCandles = await fetchMarketData();
      if (currentCandles.length === 0) throw new Error("No market data");

      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candles: currentCandles,
          pair: marketState.pair,
          timeframe: marketState.timeframe,
          mode: marketState.mode
        })
      });

      if (!resp.ok) throw new Error("Analysis failed");
      
      const data = await resp.json();
      setSignal(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Signal generation failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white uppercase leading-none">QuantAI</h1>
            <span className="text-[10px] font-mono text-indigo-400 tracking-widest uppercase">Binary Engine v2.0</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>CORE_READY</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              <span className="uppercase">{marketState.pair}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5" />
              <span>STABLE_IDLE</span>
            </div>
          </div>
          <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Neural Orchestration Engine</label>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">QUANT_AGENTS</span>
                  <span className="text-emerald-400">5 ACTIVE</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">EXEC_LOGIC</span>
                  <span className="text-indigo-400">LOCAL</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">MASTER_BRAIN</span>
                  <span className="text-indigo-400">Gemini-2.5</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Asset Selection</label>
              <div className="relative group">
                <select 
                  value={marketState.pair}
                  onChange={(e) => setMarketState(prev => ({ ...prev, pair: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-medium appearance-none focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Analysis Timeframe</label>
              <div className="grid grid-cols-2 gap-2">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf}
                    onClick={() => setMarketState(prev => ({ ...prev, timeframe: tf }))}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-lg border transition-all",
                      marketState.timeframe === tf 
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" 
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    )}
                  >
                    {tf.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Execution Mode</label>
              <div className="flex gap-2">
                {MODES.map(m => (
                  <button
                    key={m}
                    onClick={() => setMarketState(prev => ({ ...prev, mode: m }))}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-black uppercase rounded-md border transition-all",
                      marketState.mode === m 
                        ? "bg-slate-100 border-slate-100 text-slate-900" 
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={getSignal}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white text-slate-950 font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-4"
            >
              {loading ? (
                <RefreshCcw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 fill-current" />
                  <span>GET SIGNAL</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-6">
            <div className="flex items-baseline gap-2 mb-4">
              <Database className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-mono text-slate-400 uppercase tracking-widest">Network Status</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Twelve Data Feed</span>
                <span className="text-emerald-400 font-bold">CONNECTED</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Math Agents</span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Master Intelligence</span>
                <span className="text-emerald-400 font-bold">gemini-2.5-flash</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="min-h-[350px]">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    key="loading-signal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center h-full animate-pulse"
                  >
                    <Zap className="w-12 h-12 text-slate-700 animate-bounce mb-4" />
                    <p className="text-slate-400 font-mono text-center">ORCHESTRATING MULTI-AGENT ANALYSIS...</p>
                  </motion.div>
                ) : !signal ? (
                  <motion.div 
                    key="empty-signal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center h-full text-center"
                  >
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                      <Zap className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Ready for Analysis</h3>
                    <p className="text-slate-400 max-w-xs">Select your parameters and click "Get Signal" to initiate the AI quant engine.</p>
                  </motion.div>
                ) : (
                  <SignalCard signal={signal} />
                )}
              </AnimatePresence>
            </div>
            <div className="space-y-6">
              <MarketChart data={candles} />
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest">Strategy Pulse</h4>
                </div>
                <div className="space-y-2">
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <motion.div 
                      key="pulse-1"
                      animate={{ x: ["-100%", "100%"] }} 
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="h-full w-1/3 bg-indigo-500/50 blur-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono italic">
                    Analysis logic: SMC Liquidity Sweeps + Triple EMA Cross + Bayesian Probability.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <LayoutDashboard className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest">Agent Reasoning Breakdown</h3>
            </div>
            <AnimatePresence mode="wait">
              {signal ? (
                <AgentReports reports={signal.agentReports} />
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-48 border border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-slate-600 text-sm italic font-mono"
                >
                  --- WAITING FOR ANALYSIS TRIGGER ---
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-8 border-t border-slate-800 bg-slate-950 fixed bottom-0 w-full flex items-center justify-between px-6 z-50">
        <div className="flex gap-6 text-[10px] font-mono text-slate-600">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span>LIVE CONNECTION</span>
          </div>
          <span>SESSION_ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
        </div>
        <div className="text-[10px] font-mono text-slate-600">
          {lastUpdated ? `LAST_SIGNAL_RCVD: ${lastUpdated.toLocaleTimeString()}` : 'IDLE_WAITING'}
        </div>
      </footer>
    </div>
  );
}

