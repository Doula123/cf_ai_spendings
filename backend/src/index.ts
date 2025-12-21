const corsHeaders: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

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



export default {
	async fetch(req: Request): Promise<Response> {
		const url = new URL(req.url);

		if (req.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		if (url.pathname === "/api/ping") {
			return Response.json({ message: "pong", ok: true }, { headers: corsHeaders });
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
			const subscriptions = findSubscription(normalized);
			return Response.json({ ok: true, normalized, warnings, subscriptions }, { headers: corsHeaders });


		}
		return new Response("Not Found", { status: 404, headers: corsHeaders });
	},
}
