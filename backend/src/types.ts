export interface Env {
	AI: Ai;
	DB: D1Database;
  }

export type AnalyzeRequest = { text?: string };

export type NormalizedTransaction = {
	date: string | null; // Date could be optional
	merchant:string;	// Purchase with this company
	centsAmount:number; // Amount in Cents to avoid floating point issues
};
export type PossibleSubscriptions = 
{
	merchant:string;
	cadence:"weekly" | "biweekly"| "monthly" | "yearly";
	averageCents: number;
	count: number;
	lastDate:string;
	avgGapDays:number;
}
export type Category = 
	| "Entertainment"
	| "Food & Drink"
	| "Fitness"
	| "Shopping"
	| "Travel"
	| "Bills"
	| "Other";

export type CategorizedTransaction = NormalizedTransaction & { category: Category };

export type Summary = {
	totalCents: number;
	byCategoryCents: Record<Category, number>;
	byMerchantCents: Record<string, number>;
	topMerchants: Array<{ merchant: string; cents: number }>;
}

export type MonthlySummary = {
	byMonthCents: Record<string, number>;
	byMonthCategoryCents: Record<string, Record<Category, number>>;
}

export const allowedCategories: Category[] = [
  		"Entertainment",
  		"Food & Drink",
  		"Fitness",
  		"Shopping",
  		"Travel",
  		"Bills",
  		"Other",
		];