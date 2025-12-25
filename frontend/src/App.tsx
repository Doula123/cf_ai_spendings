import { useState } from "react";
import { useAnalyzer } from "./hooks/useAnalyzer";
import { StatusBadge } from "./components/StatusBadge";
import { ResultsDashboard } from "./components/ResultsDashboard";

export default function App() {
  const [text, setText] = useState("");
  const { analyze, status, data, error } = useAnalyzer();
  const isBusy = status === "running";

  const loadExample = () => {
    const example = `01-12-2025,NETFLIX.COM DIGITAL,15.99,0,1200.00
02-12-2025,AMZN MKTPLC US*2V9,42.50,0,1157.50
05-12-2025,MCDONALDS CHICAGO IL,12.50,0,1145.00
10-12-2025,UBER TRIP 1A2B3C,22.10,0,1122.90
12-12-2025,SHELL SERVICE STATION,65.00,0,1057.90
15-12-2025,S-M GYM MONTHLY,55.00,0,1002.90`;
    setText(example);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-8">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Spending AI</h1>
            <p className="text-slate-500 text-sm mt-1">Clean merchant names and detect subscriptions instantly.</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* --- MAIN GRID --- */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Input Area */}
          <div className="lg:col-span-4 space-y-3">
            
            {/* Align header and format guide */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  DD-MM-YYYY
                </span>
                <span className="text-[10px] text-slate-500 font-medium tracking-tight uppercase">
                  CSV FORMAT
                </span>
              </div>
              <button 
                onClick={loadExample}
                className="text-[10px] text-slate-400 hover:text-indigo-400 transition-colors font-medium underline underline-offset-2"
              >
                Try Example
              </button>
            </div>

            <div className="relative group">
              <div className={`absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl opacity-0 transition duration-500 group-hover:opacity-10 ${isBusy ? 'opacity-20 animate-pulse' : ''}`}></div>
              <textarea
                className="relative w-full h-[480px] bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none placeholder:text-slate-700 transition-all shadow-xl"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isBusy}
                spellCheck={false}
                placeholder="Paste rows: DATE, MERCHANT, AMOUNT..."
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={() => analyze(text)}
              disabled={isBusy || !text.trim()}
              className={`w-full py-3 rounded-lg font-medium text-sm transition-all border shadow-lg ${
                isBusy || !text.trim()
                  ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                  : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
              }`}
            >
              {isBusy ? "Processing..." : "Run Analysis"}
            </button>
          </div>

          {/* RIGHT COLUMN: Results Area */}
          <div className="lg:col-span-8">
            {!data ? (
              <div className="h-[580px] flex flex-col items-center justify-center rounded-xl border border-slate-800/60 bg-slate-900/20 text-slate-600">
                <svg className="w-12 h-12 mb-4 text-slate-800 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-medium">Waiting for data</p>
                <p className="text-xs text-slate-700 mt-1">Analysis results will appear here</p>
              </div>
            ) : (
              <div className="min-h-[580px]">
                <ResultsDashboard data={data} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}