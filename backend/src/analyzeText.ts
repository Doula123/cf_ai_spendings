import { summaryBuilder, monthSummaryBuilder, findSubscription } from "./analytics";
import { normalizedMerchant, categorizeMerchant   } from "./ai";
import type { Env, NormalizedTransaction, CategorizedTransaction, Category } from "./types";
import { parseLine } from "./index";


export async function analyzeText(env: Env, text: string) {
	const normalized: NormalizedTransaction[] = [];
	const warnings: string[] = [];
  
	for (const line of text.split("\n")) {
	  const { txn, warning } = parseLine(line);
	  if (warning) warnings.push(warning);
	  if (txn) normalized.push(txn);
	}
  
	const uniqueMerchants = Array.from(new Set(normalized.map(t => t.merchant)));
	const merchantMap = new Map<string, string>();
	await Promise.all(uniqueMerchants.map(async (m) => {
	  merchantMap.set(m, await normalizedMerchant(env, m));
	}));
  
	const normalizedMerchants = normalized.map(t => ({
	  ...t,
	  merchant: merchantMap.get(t.merchant) ?? t.merchant,
	}));
  
	const uniqueNormalizedMerchants = Array.from(new Set(normalizedMerchants.map(t => t.merchant)));
	const categoryMap = new Map<string, Category>();
	await Promise.all(uniqueNormalizedMerchants.map(async (m) => {
	  categoryMap.set(m, await categorizeMerchant(env, m));
	}));
  
	const categorized: CategorizedTransaction[] = normalizedMerchants.map(t => ({
	  ...t,
	  category: categoryMap.get(t.merchant) ?? "Other",
	}));
  
	const summary = summaryBuilder(categorized);
	const monthlySummary = monthSummaryBuilder(categorized);
	const subscriptions = findSubscription(normalizedMerchants);
  
	return { categorized, warnings, summary, monthlySummary, subscriptions, inputText: text };
}
