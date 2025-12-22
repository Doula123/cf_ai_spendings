const corsHeaders: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export interface Env {
	AI: Ai;
	DB: D1Database;
  }

type AnalyzeRequest = { text?: string };

type NormalizedTransaction = {
	date: string | null; // Date could be optional
	merchant:string;	// Purchase with this company
	centsAmount:number; // Amount in Cents to avoid floating point issues
};
type PossibleSubscriptions = 
{
	merchant:string;
	cadence:"weekly" | "biweekly"| "monthly" | "yearly";
	averageCents: number;
	count: number;
	lastDate:string;
	avgGapDays:number;
}
type Category = 
	| "Entertainment"
	| "Food & Drink"
	| "Fitness"
	| "Shopping"
	| "Travel"
	| "Bills"
	| "Other";

type CategorizedTransaction = NormalizedTransaction & { category: Category };

type Summary = {
	totalCents: number;
	byCategoryCents: Record<Category, number>;
	byMerchantCents: Record<string, number>;
	topMerchants: Array<{ merchant: string; cents: number }>;
}

type MonthlySummary = {
	byMonthCents: Record<string, number>;
	byMonthCategoryCents: Record<string, Record<Category, number>>;
}

const allowedCategories: Category[] = [
  		"Entertainment",
  		"Food & Drink",
  		"Fitness",
  		"Shopping",
  		"Travel",
  		"Bills",
  		"Other",
		];

function summaryBuilder(categorized: CategorizedTransaction[]): Summary{
	const totalCents = categorized.reduce((sum, t) => sum + t.centsAmount, 0);

	const byCategoryCents: Record<Category, number> = {
		"Entertainment": 0,
		"Food & Drink": 0,
		"Fitness": 0,
		"Shopping": 0,
		"Travel": 0,
		"Bills": 0,
		"Other": 0,
	};
	const byMerchantCents: Record<string, number> = {};

	for (const t of categorized) {
		byCategoryCents[t.category] += t.centsAmount;
		byMerchantCents[t.merchant] = (byMerchantCents[t.merchant] || 0) + t.centsAmount;
	}

	const topMerchants = Object.entries(byMerchantCents)
		.map(([merchant, cents]) => ({ merchant, cents }))
		.sort((a, b) => b.cents - a.cents)
		.slice(0, 5);

	return {
		totalCents,
		byCategoryCents,
		byMerchantCents,
		topMerchants,
	};
}

function monthSummaryBuilder(categorized: CategorizedTransaction[]): MonthlySummary {

	const byMonthCents: Record<string, number> = {};
	const byMonthCategoryCents: Record<string, Record<Category, number>> = {};

	for (const t of categorized) {
		if (!t.date) continue; // Skip if no date

		const month = monthKey(t.date);
		byMonthCents[month] = (byMonthCents[month] || 0) + t.centsAmount;

		if (!byMonthCategoryCents[month]) {
			byMonthCategoryCents[month] = {
				"Entertainment": 0,
				"Food & Drink": 0,
				"Fitness": 0,
				"Shopping": 0,
				"Travel": 0,
				"Bills": 0,
				"Other": 0,
			};
		}
		byMonthCategoryCents[month][t.category] += t.centsAmount;
	}
	return { byMonthCents, byMonthCategoryCents } 

	
}
function monthKey(date:string): string {
	return date.slice(0, 7); // YYYY-MM
}
function isCategory(x: string): x is Category {

	return allowedCategories.includes(x as Category);
		}
function median (values: number[]):number{

	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle];
	return Math.round((sorted[middle-1] + sorted[middle]) / 2);
}
function daysBetween(a:string, b:string): number {
	const dateA = new Date(a + "T00:00:00Z").getTime();
	const dateB = new Date(b + "T00:00:00Z").getTime();
	return Math.round(Math.abs(dateB - dateA) / (1000 * 60 * 60 * 24));
}
function findSubscription(txns: NormalizedTransaction[]): PossibleSubscriptions[] {

	const hasDate = txns.filter(
		(t): t is NormalizedTransaction & { date: string } => t.date !== null
	  );

	const groups = new Map<string, Array<NormalizedTransaction & {date:string}>>();
	for (const t of hasDate) 
	{
		const key = t.merchant.trim().toLowerCase(); // normalize merchant name
		const arr = groups.get(key) || []; // if key not found, create new array
		arr.push(t); // add transaction to array
		groups.set(key, arr); // set the array back to the map

	}
	const results: PossibleSubscriptions[] = [];

	for (const [, list] of groups) {
		if (list.length < 2) continue; // Need at least 2 transactions to determine cadence

		list.sort((a, b) => a.date.localeCompare(b.date)); // Sort by date

		const gaps: number[] = [];
		for (let i = 1; i < list.length; i++) 
		{
			gaps.push(daysBetween(list[i - 1].date, list[i].date)); // 	calculate gaps in days
		}
		const averageGap = gaps.reduce((sum,val ) => sum + val, 0) / gaps.length; // average gap in days

		let cadence: PossibleSubscriptions["cadence"] | null = null;
		if (averageGap >= 6 && averageGap <= 9) cadence = "weekly";
		else if (averageGap >= 12  && averageGap <= 16) cadence = "biweekly";
		else if (averageGap >= 27 && averageGap <= 32) cadence = "monthly";
		else if (averageGap >= 350 && averageGap <= 380) cadence = "yearly";

		if (!cadence) continue; // Not a recognized cadence

		const typicalCents = median(list.map(t => t.centsAmount)); // median amount
		const lastDate = list[list.length - 1].date; // last transaction date

		results.push({
			merchant: list[0].merchant,
			cadence,
			averageCents: typicalCents,
			count: list.length,
			lastDate,
			avgGapDays: Math.round(averageGap *10)/ 10, // 1 decimal
		})
	}
		results.sort((a, b) => b.count - a.count); // sort by count descending
		return results;
}
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

async function normalizedMerchant(env:Env, merchantRaw:string): Promise<string> { // Normalize merchant names using AI
	
	const merchant = merchantRaw.trim();
	if (!merchant) return merchantRaw;

	const cached = await env.DB.prepare("SELECT normalized_merchant FROM merchant_norm_cache WHERE raw_merchant = ?1")
								.bind(merchant)
								.first<{normalized_merchant:string}>();

	if (cached?.normalized_merchant) return cached.normalized_merchant;

	const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", // Llama 3.3
	{
		messages:[ 
			{
				role: "system", // Instructions for the AI
				content:
				  'You normalize merchant names from bank transactions. ' +
  				  'Remove locations, country codes, transaction IDs, asterisks, numbers, .com, and POS markers. ' +
  				  'Return the canonical brand name only. ' +
  				  'If the merchant refers to Netflix, always return "Netflix". ' +
  				  'Output ONLY JSON: {"normalizedMerchant":"..."}',
			  },
			  {
				role: "user", // The actual prompt with the merchant name
				content:
				  `Normalize this to a clean brand name.\n` +
				  `Remove codes/IDs like *1234, locations, .com, CA, POS.\n` +
				  `Keep only the brand. If unsure, return the original cleaned.\n\n` +
				  `merchant: ${merchant}`,
			  },
		],
		temperature:0,
		response_format: {type:"json_object"},
	});
	console.log("AI raw result:", JSON.stringify(result));

	const wrapper = result as { response?: string };
  	const parsed = wrapper.response ? (JSON.parse(wrapper.response) as { normalizedMerchant?: string }) : {};
  	const out = (parsed.normalizedMerchant ?? "").trim() || merchant;

  	// 3) save cache
  	await env.DB
    .prepare("INSERT OR REPLACE INTO merchant_norm_cache (raw_merchant, normalized_merchant) VALUES (?1, ?2)")
    .bind(merchant, out)
    .run();

  	return out;
}
async function categorizeMerchant(env:Env, merchant:string): Promise<Category> { // Categorize merchant using AI

	const cleaned = merchant.trim();
	if (!cleaned) return "Other";

	const cached = await env.DB
    .prepare("SELECT category FROM merchant_category_cache WHERE merchant = ?1")
    .bind(cleaned)
    .first<{ category: string }>();

 	if (cached?.category && isCategory(cached.category)) return cached.category;


	const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {  // Llama 3.3
		
		messages:[
			{
				role: "system",
        		content:
          		"You categorize merchants into ONE allowed category. " +
          		'Output ONLY JSON like {"category":"..."} and the value must be exactly one allowed category.',
			},
			{
				role: "user",
				content:
				  `Allowed categories:\n- ${allowedCategories.join("\n- ")}\n\n` +
				  `Merchant: ${cleaned}\n\n` +
				  `Return ONLY JSON.`,
			},
		],
		temperature:0,
		response_format: {type:"json_object"},
	
	});
	const wrapper = result as { response?: string };
  	const parsed = wrapper.response ? (JSON.parse(wrapper.response) as { category?: string }) : {};
  	const out = (parsed.category ?? "").trim();
  	const finalCat: Category = isCategory(out) ? out : "Other";

  	// 3) save cache
  	await env.DB
    .prepare("INSERT OR REPLACE INTO merchant_category_cache (merchant, category) VALUES (?1, ?2)")
    .bind(cleaned, finalCat)
    .run();

  	return finalCat;
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
				summary,
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
