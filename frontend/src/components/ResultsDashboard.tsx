import type { RunResult } from "../types";
import { formatCurrency } from "../utils"; 

export function ResultsDashboard({ data }: { data: RunResult }) {
  
  // 1. Calculations
  const totalSpent = data.categorized.reduce((sum, t) => sum + Math.abs(t.centsAmount), 0);
  const totalCount = data.categorized.length;

  // Sort Categories
  const categories = Object.entries(data.summary.byCategoryCents)
    .sort(([, a], [, b]) => b - a)
    .filter(([, amount]) => amount > 0);

  // Sort Top Merchants (Take top 5)
  const topMerchants = data.summary.topMerchants.slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 0. WARNINGS (If any lines failed) */}
      {data.warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-4 text-amber-200 text-sm">
          <strong>Some lines were skipped:</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1 opacity-80">
            {data.warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
            {data.warnings.length > 3 && <li>...and {data.warnings.length - 3} more</li>}
          </ul>
        </div>
      )}

      {/* 1. TOP STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Spent</h3>
          <div className="text-3xl font-mono text-white tracking-tight">{formatCurrency(totalSpent)}</div>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Recurring Bills</h3>
          <div className="text-3xl font-mono text-indigo-400 tracking-tight">{data.subscriptions.length}</div>
        </div>
        <div className="hidden md:block p-5 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl">
           <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Transactions</h3>
          <div className="text-3xl font-mono text-slate-200 tracking-tight">{totalCount}</div>
        </div>
      </div>

      {/* 2. INSIGHTS GRID */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* A. CATEGORIES */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30">
          <h3 className="font-semibold text-slate-200 mb-4">Where your money goes</h3>
          <div className="space-y-4">
            {categories.map(([cat, cents]) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{cat}</span>
                  <span className="text-slate-400 font-mono">{formatCurrency(cents)}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500/80 rounded-full" style={{ width: `${(cents / totalSpent) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* B. TOP MERCHANTS & SUBSCRIPTIONS */}
        <div className="space-y-6">
            
            {/* Top Merchants Card */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30">
                <h3 className="font-semibold text-slate-200 mb-4">Top Spenders</h3>
                <div className="space-y-3">
                    {topMerchants.map((m, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-slate-300 flex items-center gap-2">
                                <span className="text-slate-600 font-mono text-xs">#{i+1}</span> {m.merchant}
                            </span>
                            <span className="font-mono text-white">{formatCurrency(m.cents)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Subscriptions Detail Card */}
            {data.subscriptions.length > 0 && (
                <div className="p-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
                    <h3 className="font-semibold text-indigo-300 mb-4 flex items-center gap-2">
                        <span>↻</span> Monthly Bills
                    </h3>
                    <div className="space-y-3">
                        {data.subscriptions.map((sub, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                                <div>
                                    <div className="text-slate-200 font-medium">{sub.merchant}</div>
                                    <div className="text-[10px] text-indigo-400 uppercase tracking-wide">{sub.cadence}</div>
                                </div>
                                <div className="font-mono text-white">{formatCurrency(sub.averageCents)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* 3. ALL TRANSACTIONS */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-200">History</h3>
          <span className="text-xs text-slate-500 font-mono">Full List</span>
        </div>

        <div className="divide-y divide-slate-800/50 max-h-[500px] overflow-y-auto custom-scrollbar">
          {data.categorized.map((txn, i) => {
            const isSub = data.subscriptions.some(s => s.merchant === txn.merchant);
            return (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner
                    ${isSub ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30' : 'bg-slate-800 text-slate-400'}`}>
                    {isSub ? '↻' : '•'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-200 group-hover:text-white transition-colors">{txn.merchant}</p>
                      {isSub && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded uppercase font-bold">Sub</span>}
                    </div>
                    <p className="text-xs text-slate-500">{txn.date} • <span className="text-slate-400">{txn.category}</span></p>
                  </div>
                </div>
                <div className="font-mono text-sm text-slate-300">{formatCurrency(txn.centsAmount)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}