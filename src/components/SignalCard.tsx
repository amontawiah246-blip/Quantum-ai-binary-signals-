/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Minus, Clock, ShieldCheck, Zap } from "lucide-react";
import { FinalSignal } from "../types";
import { cn } from "../lib/utils";

interface SignalCardProps {
  signal: FinalSignal | null;
  loading: boolean;
}

export function SignalCard({ signal }: { signal: FinalSignal }) {
  const isBuy = signal.side === "BUY";
  const isSell = signal.side === "SELL";
  const mainColor = isBuy ? "text-emerald-400" : isSell ? "text-rose-400" : "text-slate-400";
  const borderColor = isBuy ? "border-emerald-500/30" : isSell ? "border-rose-500/30" : "border-slate-500/30";

  return (
    <motion.div 
      key={signal.timestamp}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn("bg-slate-900 border rounded-2xl p-8 min-h-[350px] flex flex-col relative overflow-hidden h-full", borderColor)}
    >
      {/* Decorative background glow */}
      <div className={cn("absolute -top-24 -right-24 w-64 h-64 blur-[80px] rounded-full opacity-20 transition-colors duration-500", isBuy ? "bg-emerald-500" : isSell ? "bg-rose-500" : "bg-slate-500")} />

      <div className="flex justify-between items-start mb-8 relative z-10">
        <div>
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest block mb-2">System Consensus</span>
          <div className="flex items-center gap-3">
            {isBuy && <TrendingUp className="w-8 h-8 text-emerald-400" />}
            {isSell && <TrendingDown className="w-8 h-8 text-rose-400" />}
            {!isBuy && !isSell && <Minus className="w-8 h-8 text-slate-400" />}
            <h2 className={cn("text-4xl font-black tracking-tighter", mainColor)}>
              {signal.side}
            </h2>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest block mb-2">Confidence</span>
          <div className="text-3xl font-bold text-white leading-none">
            {signal.confidence}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Expiry</span>
          </div>
          <p className="text-white font-bold">{signal.expirySuggestion}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Regime</span>
          </div>
          <p className="text-white font-bold">{signal.marketRegime}</p>
        </div>
      </div>

      <div className="mt-auto relative z-10">
        <p className="text-slate-300 text-sm leading-relaxed italic border-l-2 border-slate-700 pl-4">
          "{signal.reasoning}"
        </p>
      </div>

      <div className={cn("mt-6 h-1 w-full bg-slate-800 rounded-full overflow-hidden")}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${signal.confidence}%` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          className={cn("h-full", isBuy ? "bg-emerald-500" : isSell ? "bg-rose-500" : "bg-slate-500")}
        />
      </div>
    </motion.div>
  );
}
