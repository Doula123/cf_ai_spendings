import type {Env, 
	AnalyzeRequest, 
	NormalizedTransaction, 
	CategorizedTransaction, 
	Category,
	} from "./types";

import { summaryBuilder, monthSummaryBuilder, findSubscription } from "./analytics";

import { normalizedMerchant, categorizeMerchant   } from "./ai";



const corsHeaders: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};


function dateFromString(dateStr: string): string | null {
	if (dateStr.length !== 10) return null;
	if (dateStr[4] !== "-" || dateStr[7] !== "-") return null;
  
	const year = Number(dateStr.slice(0, 4));
	const month = Number(dateStr.slice(5, 7));
	const day = Number(dateStr.slice(8, 10));
  
	if (!Number.isInteger(year)) return null;
	if (!Number.isInteger(month) || month < 1 || month > 12) return null;
	if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  
	return dateStr;
  }

function amountToCents(raw:string): number | null {
	let  string = raw.trim();
	string = string.replace("$", "").replace("€", "").replace("£", "");

	string = string.split(" ").join("");

	const hasDot = string.includes(".");
	const hasComma = string.includes(",");

	if (hasDot && hasComma) {
		// Determine which is the decimal separator
		if (string.lastIndexOf(".") > string.lastIndexOf(",")) {
			string = string.split(",").join("");
		} else {
			string = string.split(".").join("").replace(",", "."); // comma is decimal
		}
	}
	else if (hasComma && !hasDot) {
		string = string.replace(",", ".");
	}
	const amount = Number(string);
	if (isNaN(amount)) {
		return null;
	}
	return Math.round(amount * 100);
}
function parseLine(line:string): {txn?: NormalizedTransaction, warning?: string}
{
	const trimmed = line.trim();
	if (!trimmed) return {};

	const parts = trimmed.split(" ").filter(p => p.length > 0); // Split by spaces
	if (parts.length < 2) return {warning: `Invalid line: "${line}"`} // Not enough information

	const amountRaw = parts[parts.length - 1]; // Grabbing the last part as amount
	const cents = amountToCents(amountRaw); // turning total amount into cents
	if (cents === null) { return {warning: `Invalid amount: "${line}"`}; } // No amount entered

	const maybeDate = dateFromString(parts[0]); // If theres a date transforming it into date

	const merchantParts = maybeDate ? 
	parts.slice(1, parts.length - 1) : parts.slice(0, parts.length - 1);

	const merchant = merchantParts.join(" ").trim();
	if (!merchant) return {warning: `Missing merchant: "${line}"`};

	return {
		txn: { 
			date: maybeDate,
			merchant,
			centsAmount: cents
		}
	}
	
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> { // Cloudflare Worker entry point
		const url = new URL(req.url);

		if (req.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		if (url.pathname === "/api/ping") {
			return Response.json({ message: "pong", ok: true }, { headers: corsHeaders });
		}

		// Previous Runs

		if (url.pathname === '/api/runs' && req.method === 'GET') {
			const {results} = await env.DB.prepare("SELECT id, created_at FROM runs ORDER BY created_at DESC LIMIT 20")
										  .all<{ id: string; created_at: string }>();
			return Response.json({ ok: true, runs: results }, { headers: corsHeaders });
		}
		// Get run by id
		if (url.pathname === '/api/run' && req.method === 'GET') {
			const id = url.searchParams.get("id");

			if (!id) {
			  return new Response("Missing run id", {
				status: 400,
				headers: corsHeaders,
			  });
			}
		  
			const row = await env.DB
			  .prepare(
				"SELECT id, created_at, input_text, summary_json FROM runs WHERE id = ?1"
			  )
			  .bind(id)
			  .first<{
				id: string;
				created_at: string;
				input_text: string;
				summary_json: string;
			  }>();
		  
			if (!row) {
			  return new Response("Run not found", {
				status: 404,
				headers: corsHeaders,
			  });
			}
		  
			const data = JSON.parse(row.summary_json);
		  
			return Response.json(
			  {
				ok: true,
				id: row.id,
				created_at: row.created_at,
				input_text: row.input_text,
				data,
			  },
			  { headers: corsHeaders }
			);
		  }
			

		if (url.pathname === '/api/analyze' && req.method === 'POST') {
			const reqBody = ( await req.json()) as AnalyzeRequest;
			const text = reqBody.text || '';
			if (!text) return new Response("Missing text", { status: 400, headers: corsHeaders });
			const normalized: NormalizedTransaction[] = [];
			const warnings: string[] = [];

			for (const line of text.split("\n"))  // Check every line
				{ 
					const { txn, warning } = parseLine(line);
					if (warning) warnings.push(warning);
					if (txn) normalized.push(txn);
				}
			// Normalize merchants using AI
			const uniqueMerchants = Array.from(new Set(normalized.map(t => t.merchant)));
			const merchantMap = new Map<string, string>();
			await Promise.all(
				uniqueMerchants.map(async (m) => {
					const norm = await normalizedMerchant(env, m);
					merchantMap.set(m, norm);
				})
			);
			const normalizedMerchants: NormalizedTransaction[] = normalized.map(t => ({
				...t,
				merchant: merchantMap.get(t.merchant) ?? t.merchant,
			}));

			// Categorize merchants using AI

			const uniqueNormalizedMerchants = Array.from(new Set(normalizedMerchants.map(t => t.merchant)));
			const categoryMap = new Map<string, Category>();
			await Promise.all(
				uniqueNormalizedMerchants.map(async (m) => {
					const category = await categorizeMerchant(env, m);
					categoryMap.set(m, category);
				})
			)
			const categorized: CategorizedTransaction[] = normalizedMerchants.map(t => ({
				...t,
				category: categoryMap.get(t.merchant) ?? "Other",
			}));

			// Build Summary

			const summary = summaryBuilder(categorized);

			// Build monthly Summary

			const monthlySummary = monthSummaryBuilder(categorized);

			// Subscriptions

			const subscriptions = findSubscription(normalizedMerchants);

			// Save runID

			const runId = crypto.randomUUID();
			await env.DB.prepare(
			"INSERT INTO runs (id, input_text, summary_json) VALUES (?1, ?2, ?3)")
			.bind(runId, text, JSON.stringify({ summary, monthlySummary, subscriptions }))
			.run();
		  
			return Response.json({ 
				 ok: true,
				 runId,
				 transactions: categorized, 
				 warnings, 
				 subscriptions,
				 summary,
				 monthlySummary }, 
				 { headers: corsHeaders }
				) ;

		}
		return new Response("Not Found", { status: 404, headers: corsHeaders });
	},
}
