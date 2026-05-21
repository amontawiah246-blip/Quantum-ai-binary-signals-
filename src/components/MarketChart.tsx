/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Candle } from '../types';

interface MarketChartProps {
  data: Candle[];
}

export function MarketChart({ data }: MarketChartProps) {
  if (!data || data.length === 0) return null;

  // Formatting data for AreaChart
  const chartData = data.map(c => ({
    time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: c.close
  }));

  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const padding = (maxPrice - minPrice) * 0.1;

  return (
    <div className="h-[250px] w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest leading-none">Market Activity (Latest 50 Candles)</h3>
        <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-1 rounded leading-none">LIVE FEED</span>
      </div>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
          <XAxis 
            dataKey="time" 
            hide 
          />
          <YAxis 
            domain={[minPrice - padding, maxPrice + padding]} 
            orientation="right"
            tick={{ fill: '#475569', fontSize: 10 }}
            tickFormatter={(val) => val.toFixed(4)}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '12px', color: '#fff' }}
            itemStyle={{ color: '#818cf8' }}
            labelStyle={{ display: 'none' }}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="#6366f1" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            animationDuration={2000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
