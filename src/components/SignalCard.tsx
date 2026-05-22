/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { TrendingUp, TrendingDown, PauseCircle, Clock, Activity, Zap, CheckCircle } from "lucide-react";
import { FinalSignal } from "../types";
import { cn } from "../lib/utils";

export function SignalCard({ signal }: { signal: FinalSignal }) {
  const isBuy  = signal.side === "BUY";
  const isSell = signal.side === "SELL";
  const isWait = signal.side === "WAIT" || signal.side === "NEUTRAL";

  const mainColor  = isBuy ? "text-emerald-400" : isSell ? "text-rose-400" : "text-amber-400";
  const glowColor  = isBuy ? "bg-emerald-500"   : isSell ? "bg-rose-500"   : "bg-amber-500";
  const barColor   = isBuy ? "bg-emerald-500"   : isSell ? "bg-rose-500"   : "bg-amber-500";
  const borderColor = isBuy ? "border-emerald-500/25" : isSell ? "border-rose-500/25" : "border-amber-500/25";

  const volColor = signal.volatility === "High" ? "text-rose-400" :
                   signal.volatility === "Low"  ? "text-slate-500" : "text-emerald-400";

  return (
    <motion.div
      key={signal.timestamp}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn("bg-slate-900 border rounded-2xl p-8 min-h-[360px] flex flex-col relative overflow-hidden h-full", borderColor)}
    >
      {/* Glow */}
      <div className={cn("absolute -top-24 -right-24 w-64 h-64 blur-[80px] rounded-full opacity-15 transition-all duration-700", glowColor)} />

      {/* Top row */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">System Consensus</span>
          <div className="flex items-center gap-3">
            {isBuy  && <TrendingUp   className="w-8 h-8 text-emerald-400" />}
            {isSell && <TrendingDown className="w-8 h-8 text-rose-400" />}
            {isWait && <PauseCircle  className="w-8 h-8 text-amber-400" />}
            <h2 className={cn("text-5xl font-black tracking-tighter", mainColor)}>
              {signal.side === "NEUTRAL" ? "WAIT" : signal.side}
            </h2>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Confidence</span>
          <div className={cn("text-3xl font-bold leading-none", signal.confidence >= 75 ? "text-white" : signal.confidence >= 60 ? "text-amber-300" : "text-slate-400")}>
            {signal.confidence}%
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wide">Expiry</span>
          </div>
          <p className="text-white text-xs font-bold leading-tight">{signal.expirySuggestion}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wide">Regime</span>
          </div>
          <p className="text-white text-xs font-bold leading-tight">{signal.marketRegime}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wide">Volatility</span>
          </div>
          <p className={cn("text-xs font-bold leading-tight", volColor)}>{signal.volatility}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wide">Confluence</span>
          </div>
          <p className="text-white text-xs font-bold leading-tight">{signal.confluenceScore || "—"}</p>
        </div>
      </div>

      {/* Reasoning */}
      <div className="relative z-10 flex-1">
        <p className="text-slate-300 text-sm leading-relaxed italic border-l-2 border-slate-700 pl-4">
          "{signal.reasoning}"
        </p>
      </div>

      {/* Confidence bar */}
      <div className="mt-5 relative z-10">
        <div className="flex justify-between text-[10px] font-mono text-slate-600 mb-1.5">
          <span>SIGNAL STRENGTH</span>
          <span>{signal.confidence}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${signal.confidence}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            className={cn("h-full rounded-full", barColor)}
          />
        </div>
      </div>
    </motion.div>
  );
}
