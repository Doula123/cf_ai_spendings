import type {Env, 
	AnalyzeRequest, 
	NormalizedTransaction, 
	} from "./types";
export {AnalyzeWorkflow} from "./workflows/analyze";


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
	let  cleanString = raw.trim();
	cleanString = cleanString.replace("$", "").replace("€", "").replace("£", "");

	cleanString = cleanString.split(" ").join("");

	const hasDot = cleanString.includes(".");
	const hasComma = cleanString.includes(",");

	if (hasDot && hasComma) {
		// Determine which is the decimal separator
		if (cleanString.lastIndexOf(".") > cleanString.lastIndexOf(",")) {
			cleanString = cleanString.split(",").join("");
		} else {
			cleanString = cleanString.split(".").join("").replace(",", "."); // comma is decimal
		}
	}
	else if (hasComma && !hasDot) {
		cleanString = cleanString.replace(",", ".");
	}
	const amount = Number(cleanString);
	if (isNaN(amount)) {
		return null;
	}
	return Math.round(amount * 100);
}

function splitCSVLine(line:string): string[] {
	const result: string[] = [];
	let currentPart = "";
	let inQuotes = false;

	for (const char of line) {
		if (char === '"') 
			inQuotes = !inQuotes;
		else if (char === ',' && !inQuotes) { // 
			result.push(currentPart.trim());
			currentPart = "";
		}
		else 
		{
			currentPart += char;
		}
	}
	result.push(currentPart.trim());
	return result;
	
}
export function parseLine(line:string): {txn?: NormalizedTransaction, warning?: string}
{
	const trimmed = line.trim();
	if (!trimmed || trimmed === "0" || trimmed.toLowerCase().includes("date")) return {}; // Skip empty lines or headers

	let parts: string[]

	if (trimmed.includes(","))
		parts = splitCSVLine(trimmed) // Split by commas

    else
	{
		parts = trimmed.split(" ")
		const temp = [] 
		for (let p of parts)
		{
			if (p.trim() !== "")
				temp.push(p.trim());
			parts = temp;
		}
	}

	if (parts.length < 2) {
		return { warning: `Could not parse line: "${line}"` };
	}

	let date: string | null = null;
	let cents: number | null = null;
	let isRefund = false;
	let possibleMerchants: string[] = [];

	for (let i=0; i< parts.length; i++) { // 
		let cleanPart = parts[i];
		if (cleanPart.startsWith('"'))  // Remove starting quotes
			cleanPart = cleanPart.slice(1);
			
		if (cleanPart.endsWith('"')) // Remove quotes
			cleanPart = cleanPart.slice(0, -1);
		cleanPart = cleanPart.trim();

		if (!cleanPart) continue;
		// Check for Date 
		const dateFound = dateFromString(cleanPart);
		if (dateFound && !date) {
			date = dateFound;
			continue;
		}

		const val = amountToCents(cleanPart);
		if (val !== null && cents === null && val !== 0) {
			cents = val;
			if (i=== 3 || cleanPart.includes("-")) // Refund detection
				isRefund = true;
			continue;
		}
		if(isNaN(Number(cleanPart)) && cleanPart.length > 2) // Not a number, possible merchant
			possibleMerchants.push(cleanPart);
	}

	if (cents === null )
	{
		return { warning: `Could not find amount in line: "${line}"` };
	}
	possibleMerchants.sort((a,b) => b.length - a.length);
	const merchant = possibleMerchants.length > 0 ? possibleMerchants[0] : "Unknown Merchant";

	return {
		txn: { 
			date,
			merchant,
			centsAmount: isRefund ? -Math.abs(cents) : Math.abs(cents),
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
				"SELECT id, created_at, input_text, summary_json, status FROM runs WHERE id = ?1"
			  )
			  .bind(id)
			  .first<{
				id: string;
				created_at: string;
				input_text: string;
				summary_json: string;
				status: string;
			  }>();
		  
			if (!row) {
			  return new Response("Run not found", {
				status: 404,
				headers: corsHeaders,
			  });
			}
		  
			let data;
			try {
    			data = JSON.parse(row.summary_json);
			} catch (e) {
    			console.error("Failed to parse summary_json", e);
    			data = null; 
			}
		  
			return Response.json(
			  {
				ok: true,
				id: row.id,
				status: row.status,
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
			

			// Save runID

			const runId = crypto.randomUUID();
			await env.DB.prepare(
				"INSERT INTO runs (id, input_text, summary_json, status) VALUES (?1, ?2, ?3, 'pending')")
				.bind(runId, text, "{}")
				.run();
 
			await env.ANALYZE_WORKFLOW.create({id:runId, params: {runId, text}});
		  
			return Response.json({ 
				 ok: true,
				 runId,
				 }, 
				 { headers: corsHeaders }
				) ;

		}
		return new Response("Not Found", { status: 404, headers: corsHeaders });
	},
}
