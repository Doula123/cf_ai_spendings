import { useState, useRef, useEffect, useCallback } from "react";
import type {RunResult, AnalyzerStatus} from "../types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function useAnalyzer() // Custom hook to analyze text
{
    const [status, setStatus] = useState<AnalyzerStatus>("idle");
    const [data, setData] = useState<RunResult | null>(null);
    const [error, setError] = useState<string>("");

    const isMounted = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            abortControllerRef.current?.abort();
        };
    },[] );

    const analyze = useCallback(async (text: string) => {


        if (!BACKEND_URL)
        {
            setError("Backend URL is not configured.");
            setStatus("error");
            return;
        }
        if (abortControllerRef.current) abortControllerRef.current.abort();    // Abort any ongoing request
         abortControllerRef.current = new AbortController(); // Create a new AbortController for this request
        const signal = abortControllerRef.current.signal; //  Get the signal from the AbortController

        setStatus("running");
        setData(null);
        setError("");

        try
        {
            const startRes = await fetch(`${BACKEND_URL}/api/analyze`, {
                method: "POST",
                headers: {"Content-Type": "application/json",},
                body: JSON.stringify({text,}),
                signal,
            });
            if (!startRes.ok)
            {
                throw new Error(`Failed to start analysis: ${startRes.statusText}`);
            }
            const {runId}  = await startRes.json();

            while (true)
            {
                if (!isMounted.current) return;  // Check if component is still mounted
                await new Promise((r) => setTimeout(r, 1500));
                if (!isMounted.current) return; // Check again after delay

                const pollRes = await fetch(`${BACKEND_URL}/api/run?id=${runId}`, {signal,});
                const json = await pollRes.json();

                if (json.status === "completed")
                {
                  if (isMounted.current) // Final check before updating state
                  {
                    setData(json.data);
                    setStatus("completed");
                  }
                  break;
                }
                if (json.status === "failed")
                {
                    throw new Error(json.data?.error || "Analysis failed.");
                }
            }
        } catch (err:any)
        {
           if (err.name === "AbortError") {
                // Request was aborted, do nothing
                return;
            }
            console.log("Error during analysis:", err);
            if (isMounted.current) {
            setError(err.message || "An unknown error occurred.");
            setStatus("error");
            }
        }
    }, [])

    return { status, data, error, analyze}; 
} 