/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Brain, ShieldAlert, LineChart, Target, Binary } from "lucide-react";
import { AgentReport } from "../types";
import { cn } from "../lib/utils";

interface AgentReportsProps {
  reports: AgentReport[];
}

export function AgentReports({ reports }: AgentReportsProps) {
  const getIcon = (name: string) => {
    if (name.includes("Trend")) return <LineChart className="w-4 h-4" />;
    if (name.includes("SMC") || name.includes("Vision")) return <Target className="w-4 h-4" />;
    if (name.includes("Execution") || name.includes("Indicator")) return <Binary className="w-4 h-4" />;
    if (name.includes("Statistical") || name.includes("Match")) return <Brain className="w-4 h-4" />;
    return <ShieldAlert className="w-4 h-4" />;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {reports.map((report, index) => (
        <motion.div
          key={report.name}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-indigo-400">
                {getIcon(report.name)}
              </div>
              <h4 className="font-bold text-slate-200 text-sm tracking-tight">{report.name}</h4>
            </div>
            {report.confidence > 0 && (
              <span className={cn(
                "px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter",
                report.side === "BUY" ? "bg-emerald-500/20 text-emerald-400" : 
                report.side === "SELL" ? "bg-rose-500/20 text-rose-400" : "bg-slate-500/20 text-slate-400"
              )}>
                {report.side} {report.confidence}%
              </span>
            )}
          </div>
          <p className="text-slate-400 text-[11px] leading-[1.6] font-mono whitespace-pre-line">
            {report.reasoning}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
