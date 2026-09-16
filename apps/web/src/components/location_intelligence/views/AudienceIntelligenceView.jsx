import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Mock trend data for Audience Trend (7D & 30D)
const TREND_DATA_7D = [
  { day: 'Mon', audience: 11200 },
  { day: 'Tue', audience: 13800 },
  { day: 'Wed', audience: 17200 },
  { day: 'Thu', audience: 15400 },
  { day: 'Fri', audience: 18600 },
  { day: 'Sat', audience: 16100 },
  { day: 'Sun', audience: 14200 },
];

const TREND_DATA_30D = [
  { day: 'W1', audience: 84000 },
  { day: 'W2', audience: 96000 },
  { day: 'W3', audience: 112000 },
  { day: 'W4', audience: 105000 },
];

// Heatmap matrix data (7 days x 9 time-slots: 00, 03, 06, 09, 12, 15, 18, 21, 24)
const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_HOURS = ['00', '03', '06', '09', '12', '15', '18', '21', '24'];

const HEATMAP_MATRIX = [
  [0.10, 0.08, 0.25, 0.70, 0.60, 0.68, 0.95, 0.72, 0.30], // Mon
  [0.12, 0.09, 0.28, 0.74, 0.62, 0.70, 0.98, 0.75, 0.32], // Tue
  [0.11, 0.07, 0.30, 0.78, 0.65, 0.72, 0.96, 0.78, 0.35], // Wed
  [0.10, 0.08, 0.27, 0.72, 0.61, 0.69, 0.92, 0.74, 0.31], // Thu
  [0.15, 0.10, 0.32, 0.80, 0.70, 0.78, 1.00, 0.85, 0.45], // Fri
  [0.20, 0.15, 0.22, 0.45, 0.75, 0.82, 0.88, 0.80, 0.50], // Sat
  [0.18, 0.12, 0.18, 0.38, 0.68, 0.72, 0.78, 0.65, 0.38], // Sun
];

const getHeatmapBg = (val) => {
  if (val < 0.20) return 'bg-[#121b33] border-[#1e294d] text-white/40';
  if (val < 0.40) return 'bg-[#1a367c] border-[#254ab8] text-white/60';
  if (val < 0.60) return 'bg-[#2563eb] border-[#3b82f6] text-white/80';
  if (val < 0.80) return 'bg-[#0284c7] border-[#0ea5e9] text-white font-bold';
  return 'bg-[#00f0ff] border-[#60a5fa] text-[#050816] font-black shadow-[0_0_12px_rgba(0,240,255,0.4)]';
};

export default function AudienceIntelligenceView({ selectedBillboard }) {
  const [timeFilter, setTimeFilter] = useState('Today');
  const [trendRange, setTrendRange] = useState('7D');
  const [showAllSegments, setShowAllSegments] = useState(false);
  const [activeCatchmentRadius, setActiveCatchmentRadius] = useState('1km');

  // Advertiser Targeting Checkbox states
  const [targetCriteria, setTargetCriteria] = useState({
    ageGroup: true,
    professionals: true,
    purchasingPower: true,
    eveningCommuters: true,
    frequentVisitors: false,
  });

  const toggleCriteria = (key) => {
    setTargetCriteria((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculate target match percentage dynamically
  const activeCount = Object.values(targetCriteria).filter(Boolean).length;
  const matchPercentage = Math.min(98, Math.max(65, 60 + activeCount * 7.5));

  const billboardName = selectedBillboard?.name || selectedBillboard?.location || 'Anna Nagar – Shanthi Colony Junction';

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 min-w-0 bg-[#070913] text-white font-sans overflow-y-auto">
      
      {/* ── HEADER BANNER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f1424]/90 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col gap-1 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black font-heading tracking-wide uppercase text-white">
              AUDIENCE INTELLIGENCE
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-400 text-[10px] font-black uppercase tracking-wider">
              {billboardName.split('–')[0].trim()}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Understand who sees your billboard, when they are there, and how they engage.
          </p>
        </div>

        {/* Top Right Date Filter */}
        <div className="relative z-10 shrink-0">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-4 py-2 bg-[#121829] border border-white/15 rounded-xl text-xs text-white font-semibold cursor-pointer outline-none focus:border-blue-500 transition-all shadow-inner"
          >
            <option value="Today">📅 Today</option>
            <option value="7D">📅 Last 7 Days</option>
            <option value="30D">📅 Last 30 Days</option>
            <option value="Custom">📅 Custom Range</option>
          </select>
        </div>
      </div>

      {/* ── TOP ROW KPI CARDS (7 CARDS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        
        {/* Card 1: Estimated Reach */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tight">Est. Reach</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
              <i className="fa-solid fa-users" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white font-mono">14.2K</span>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Unique people</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1">
              <i className="fa-solid fa-caret-up" />
              <span>12.4% vs yesterday</span>
            </div>
          </div>
        </div>

        {/* Card 2: Estimated Impressions */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tight">Est. Impressions</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
              <i className="fa-solid fa-eye" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white font-mono">42.8K</span>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Total exposures</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1">
              <i className="fa-solid fa-caret-up" />
              <span>15.6% vs yesterday</span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Audience */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tight">Active Audience</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
              <i className="fa-solid fa-user-check" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white font-mono">6.8K</span>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">People present</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1">
              <i className="fa-solid fa-caret-up" />
              <span>9.3% vs yesterday</span>
            </div>
          </div>
        </div>

        {/* Card 4: Peak Audience */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tight">Peak Audience</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
              <i className="fa-solid fa-chart-line" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white font-mono">2.4K <span className="text-xs font-normal text-slate-400">/hr</span></span>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">6:00 PM - 7:00 PM</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1">
              <i className="fa-solid fa-caret-up" />
              <span>18.4% vs last week</span>
            </div>
          </div>
        </div>

        {/* Card 5: Avg. Dwell Time */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tight">Avg. Dwell Time</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
              <i className="fa-solid fa-clock" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white font-mono">3m 42s</span>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Average time spent</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1">
              <i className="fa-solid fa-caret-up" />
              <span>6.2% vs last week</span>
            </div>
          </div>
        </div>

        {/* Card 6: Audience Quality Score */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tight">Quality Score</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
              <i className="fa-solid fa-bullseye" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white font-mono">86<span className="text-xs font-normal text-slate-400">/100</span></span>
            <div className="text-[10px] text-emerald-400 font-bold mt-1">High quality audience</div>
          </div>
        </div>

        {/* Card 7: Repeat Exposure */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tight">Repeat Exposure</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
              <i className="fa-solid fa-rotate" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white font-mono">3.2x</span>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Avg. exposure freq.</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1">
              <i className="fa-solid fa-caret-up" />
              <span>11.7% vs last week</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 1: AUDIENCE TREND & AUDIENCE SEGMENTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card: Audience Trend (Spans 2 Columns) */}
        <div className="lg:col-span-2 bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white font-heading">Audience Trend</h3>
              <i className="fa-solid fa-circle-info text-xs text-slate-500" title="Daily total audience exposure trend" />
            </div>

            {/* 7D / 30D Range Toggle */}
            <div className="flex items-center gap-1 bg-[#121829] border border-white/10 p-1 rounded-xl">
              {['7D', '30D', 'Custom'].map((r) => (
                <button
                  key={r}
                  onClick={() => setTrendRange(r)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    trendRange === r
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendRange === '7D' ? TREND_DATA_7D : TREND_DATA_30D}>
                <defs>
                  <linearGradient id="audienceGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                  formatter={(val) => [`${val.toLocaleString()} people`, 'Audience']}
                />
                <Area type="monotone" dataKey="audience" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#audienceGlow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card: Audience Segments (1 Column) */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-heading">Audience Segments</h3>
                <i className="fa-solid fa-circle-info text-xs text-slate-500" title="Demographic segment proportions" />
              </div>
            </div>

            <div className="space-y-3.5">
              {[
                { label: 'Professionals', pct: 32, icon: 'fa-user-tie', color: 'bg-blue-500' },
                { label: 'Commuters', pct: 41, icon: 'fa-car-side', color: 'bg-cyan-400' },
                { label: 'Shoppers', pct: 24, icon: 'fa-bag-shopping', color: 'bg-indigo-500' },
                { label: 'Students', pct: 18, icon: 'fa-graduation-cap', color: 'bg-purple-500' },
                { label: 'Residents', pct: 27, icon: 'fa-[#00f0ff] fa-house', color: 'bg-emerald-500' },
                { label: 'Visitors', pct: 13, icon: 'fa-plane-arrival', color: 'bg-amber-500' },
              ].map((seg) => (
                <div key={seg.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                      <i className={`fa-solid ${seg.icon} text-slate-400 text-xs w-4`} />
                      <span>{seg.label}</span>
                    </div>
                    <span className="font-mono font-bold text-white">{seg.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#121829] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${seg.color}`} style={{ width: `${seg.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowAllSegments(!showAllSegments)}
            className="w-full mt-5 py-2.5 bg-[#121829] hover:bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-blue-400 transition-all cursor-pointer"
          >
            {showAllSegments ? 'Collapse Segments' : 'View All Segments'}
          </button>
        </div>

      </div>

      {/* ── ROW 2: AUDIENCE BY TIME HEATMAP, ATTENTION DWELL & PEAK AUDIENCE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Card: Audience by Time (Heatmap) */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-heading">Audience by Time</h3>
                <i className="fa-solid fa-circle-info text-xs text-slate-500" title="Hourly density across day of week" />
              </div>
            </div>

            {/* Matrix header: Hours */}
            <div className="grid grid-cols-10 text-[9px] font-mono text-slate-400 font-bold text-center mb-2">
              <div></div>
              {HEATMAP_HOURS.map((h) => (
                <div key={h}>{h}</div>
              ))}
            </div>

            {/* Matrix body */}
            <div className="space-y-1.5">
              {HEATMAP_DAYS.map((day, dIdx) => (
                <div key={day} className="grid grid-cols-10 gap-1 items-center">
                  <div className="text-[10px] font-semibold text-slate-400">{day}</div>
                  {HEATMAP_MATRIX[dIdx].map((val, hIdx) => (
                    <div
                      key={hIdx}
                      className={`h-5 rounded border transition-all hover:scale-110 cursor-pointer ${getHeatmapBg(val)}`}
                      title={`${day} @ ${HEATMAP_HOURS[hIdx]}:00 - Density Score: ${(val * 100).toFixed(0)}%`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-4 pt-3 border-t border-white/10">
            <span>Low Audience</span>
            <div className="h-2 w-32 rounded-full bg-gradient-to-r from-[#121b33] via-[#2563eb] to-[#00f0ff]" />
            <span>High Audience</span>
          </div>
        </div>

        {/* Card: Audience Attention (Dwell Time Distribution) */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-heading">Audience Attention</h3>
                <i className="fa-solid fa-circle-info text-xs text-slate-500" title="Dwell Time Distribution" />
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Dwell Distribution</span>
            </div>

            <div className="space-y-3">
              {[
                { range: '< 30 sec', pct: 18, color: 'bg-blue-500' },
                { range: '30 – 60 sec', pct: 27, color: 'bg-cyan-400' },
                { range: '1 – 3 min', pct: 36, color: 'bg-blue-600' },
                { range: '3 – 5 min', pct: 13, color: 'bg-indigo-500' },
                { range: '5+ min', pct: 6, color: 'bg-purple-500' },
              ].map((item) => (
                <div key={item.range} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-slate-300 font-medium">{item.range}</span>
                  <div className="flex-1 h-3 bg-[#121829] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs font-mono font-bold text-white">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
            <span className="text-xs font-bold text-blue-300">
              Average Dwell Time: <span className="font-mono text-white font-black">3m 42s</span>
            </span>
          </div>
        </div>

        {/* Card: Peak Audience Card */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🔥</span>
              <h3 className="text-sm font-bold text-white font-heading">Peak Audience</h3>
            </div>
            <i className="fa-solid fa-circle-info text-xs text-slate-500" title="Highest concentration period" />
          </div>

          <div className="my-auto py-2">
            <div className="text-3xl font-black text-white font-mono">
              2,418 <span className="text-sm font-normal text-slate-400">people/hr</span>
            </div>
            <div className="text-sm font-bold text-amber-400 mt-1">
              6:00 PM – 7:00 PM
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
              <i className="fa-solid fa-caret-up" />
              <span>18.4% vs previous week</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 leading-relaxed mt-4">
            Highest concentration observed during evening commute.
          </div>
        </div>

      </div>

      {/* ── ROW 3: AUDIENCE CATCHMENT, QUALITY SCORE, TARGETING & AI INSIGHTS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Card 1: Audience Catchment */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <h3 className="text-sm font-bold text-white font-heading">Audience Catchment</h3>
              <i className="fa-solid fa-circle-info text-xs text-slate-500" />
            </div>

            {/* Concentric radius preview graphic */}
            <div className="relative w-full h-36 rounded-xl bg-[#080d1a] border border-white/10 flex items-center justify-center overflow-hidden my-2">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:12px_12px]" />
              
              {/* Radius circles */}
              <div className="absolute w-32 h-32 rounded-full border border-purple-500/40 bg-purple-500/5 animate-pulse" />
              <div className="absolute w-24 h-24 rounded-full border border-blue-500/50 bg-blue-500/10" />
              <div className="absolute w-14 h-14 rounded-full border border-emerald-500/60 bg-emerald-500/20 flex items-center justify-center">
                <i className="fa-solid fa-location-dot text-emerald-400 text-xs" />
              </div>
            </div>

            <div className="space-y-2 mt-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-300 font-medium">500m Radius</span>
                </div>
                <span className="font-mono font-bold text-white">4.2K Est.</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-slate-300 font-medium">1km Radius</span>
                </div>
                <span className="font-mono font-bold text-white">11.8K Est.</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  <span className="text-slate-300 font-medium">1.5km Radius</span>
                </div>
                <span className="font-mono font-bold text-white">18.6K Est.</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-3 border-t border-white/10 mt-3">
            <span>High Activity Areas:</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Low</span>
            </div>
          </div>
        </div>

        {/* Card 2: Audience Quality Score Breakdown */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <h3 className="text-sm font-bold text-white font-heading">Audience Quality Score</h3>
              <i className="fa-solid fa-circle-info text-xs text-slate-500" />
            </div>

            <div className="flex items-center gap-4 my-2">
              {/* Score Arc / Ring */}
              <div className="w-20 h-20 rounded-full border-4 border-emerald-400/30 border-t-emerald-400 flex flex-col items-center justify-center shrink-0 shadow-[0_0_15px_rgba(52,211,153,0.2)]">
                <span className="text-xl font-black font-mono text-white leading-none">86</span>
                <span className="text-[9px] text-slate-400 font-semibold">/100</span>
              </div>

              {/* Progress Bars */}
              <div className="flex-1 space-y-1.5 text-[11px]">
                {[
                  { label: 'Reach', score: 91 },
                  { label: 'Dwell', score: 84 },
                  { label: 'Repeat Exp.', score: 88 },
                  { label: 'Target Fit', score: 81 },
                  { label: 'Traffic Quality', score: 86 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-medium truncate">{item.label}</span>
                    <div className="w-16 h-1.5 bg-[#121829] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${item.score}%` }} />
                    </div>
                    <span className="font-mono font-bold text-white text-[10px]">{item.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-300 leading-relaxed mt-2">
            <div className="font-bold text-emerald-400 mb-0.5">✨ Why this score?</div>
            High evening commuter density, strong repeat exposure and above-average dwell time contribute to the score.
          </div>
        </div>

        {/* Card 3: Advertiser Targeting */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <h3 className="text-sm font-bold text-white font-heading">Advertiser Targeting</h3>
              <i className="fa-solid fa-circle-info text-xs text-slate-500" />
            </div>

            <div className="text-[11px] text-slate-400 font-semibold mb-2">Select Your Target Audience</div>

            <div className="space-y-2">
              {[
                { key: 'ageGroup', label: '25 – 44 Age Group' },
                { key: 'professionals', label: 'Professionals' },
                { key: 'purchasingPower', label: 'High Purchasing Power' },
                { key: 'eveningCommuters', label: 'Evening Commuters' },
                { key: 'frequentVisitors', label: 'Frequent Visitors' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={targetCriteria[item.key]}
                    onChange={() => toggleCriteria(item.key)}
                    className="w-4 h-4 rounded accent-blue-500 bg-[#121829] border-white/20 cursor-pointer"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="text-xs text-slate-400 font-semibold">Target Audience Match</div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{matchPercentage}%</div>
            <div className="text-[11px] text-slate-300 font-medium mt-0.5">
              This billboard strongly matches your selected audience.
            </div>
          </div>
        </div>

        {/* Card 4: AI Audience Insights */}
        <div className="bg-[#0f1424]/90 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <h3 className="text-sm font-bold text-white font-heading">AI Audience Insights</h3>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02]">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <div className="font-bold text-white">Evening Opportunity</div>
                  <div className="text-slate-400 text-[11px] leading-tight mt-0.5">
                    Audience concentration is 34% higher between 5 PM – 8 PM.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02]">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <div className="font-bold text-white">Strong Commuter Audience</div>
                  <div className="text-slate-400 text-[11px] leading-tight mt-0.5">
                    41% of observed audience activity occurs during commuter periods.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02]">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <div className="font-bold text-white">High Repeat Exposure</div>
                  <div className="text-slate-400 text-[11px] leading-tight mt-0.5">
                    Traffic patterns indicate an estimated 3.2x repeat exposure opportunity.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-600/15 border border-blue-500/30 text-center mt-3">
            <div className="text-[10px] text-blue-300 uppercase tracking-wider font-extrabold">Recommended Campaign Window</div>
            <div className="text-sm font-black text-white font-mono mt-0.5 flex items-center justify-center gap-1.5">
              <i className="fa-regular fa-clock text-blue-400 text-xs" />
              <span>5:30 PM – 8:30 PM</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── FOOTER CAPTION ── */}
      <div className="text-center py-2 text-[11px] text-slate-500 font-medium">
        All audience insights are estimated using AI models and anonymized data sources.
      </div>

    </div>
  );
}
