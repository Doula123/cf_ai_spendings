import type { AnalyzerStatus } from "../types";

// A clean, simple loading spinner icon
function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

// Solid circle for static states
function Dot({ color }: { color: string }) {
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

export function StatusBadge({ status }: { status: AnalyzerStatus }) {
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900/50 w-32 justify-center transition-colors">
      
      {/* 1. The Icon Changes */}
      {status === "running" ? (
        <Spinner />
      ) : status === "completed" ? (
        <Dot color="bg-emerald-400" />
      ) : status === "error" ? (
        <Dot color="bg-red-400" />
      ) : (
        <Dot color="bg-slate-500" />
      )}

      {/* 2. The Text */}
      <span className="text-xs font-medium text-slate-300">
        {status === "idle" && "Ready"}
        {status === "running" && "Processing"}
        {status === "completed" && "Complete"}
        {status === "error" && "Failed"}
      </span>
    </div>
  );
}