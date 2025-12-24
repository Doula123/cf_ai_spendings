import type { Subscription } from "../types";

export function SubscriptionCard({ sub }: { sub: Subscription }) {
  return (
    <div className="group flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-600 transition-all cursor-default">
      <div className="flex items-center gap-4">
        {/* Merchant Icon - Subtle Circle */}
        <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-colors">
          <span className="font-bold text-slate-400 group-hover:text-indigo-400 transition-colors">
            {sub.merchant.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Text Details */}
        <div>
          <div className="font-medium text-slate-200 text-sm">{sub.merchant}</div>
          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            <span className="capitalize">{sub.cadence}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-slate-600" /> {/* Tiny dot separator */}
            <span>{sub.count} payments</span>
          </div>
        </div>
      </div>

      {/* Price - Monospace for numbers is key for fintech apps */}
      <div className="text-right">
        <div className="text-slate-200 font-mono font-medium text-sm">
          ${(sub.averageCents / 100).toFixed(2)}
        </div>
        <div className="text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">
          Average
        </div>
      </div>
    </div>
  );
}