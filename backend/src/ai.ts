import type { Env, Category } from "./types";
import { allowedCategories } from "./types";
import { isCategory } from "./analytics";

 
async function aiRunWithRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> { // Retry AI calls with exponential backoff
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const delay = [200, 500, 1200, 2500][i] ?? 3000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }


export async function normalizedMerchant(env:Env, merchantRaw:string): Promise<string> { // Normalize merchant names using AI
	
	const merchant = merchantRaw.trim();
	if (!merchant) return merchantRaw;

	const cached = await env.DB.prepare("SELECT normalized_merchant FROM merchant_norm_cache WHERE raw_merchant = ?1")
								.bind(merchant)
								.first<{normalized_merchant:string}>();

	if (cached?.normalized_merchant) return cached.normalized_merchant;

	const result = await aiRunWithRetry(() => env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, // Llama 3.1 8b
	{
		messages:[ 
			{
				role: "system", // Instructions for the AI
				content:
				  'You are a linguistic expert specializing in brand names. ' +
          		  'Normalize merchant names by removing transaction codes, IDs, and locations. ' +
          		  'CRITICAL: Do not truncate or "guess" words based on prefixes. ' +
          		  'Treat the string as a complete entity (e.g., if a name is unfamiliar, do not assume it is a fragment of a common word). ' +
          		  'Output ONLY JSON: {"normalizedMerchant":"..."}',
			  },
			  {
				role: "user", // The actual prompt with the merchant name
				content:
				  `Normalize this to a clean brand name.\n` +
				  `Remove codes/IDs like *1234, locations, .com, CA, POS.\n` +
				  `Keep only the brand. If unsure, return the original cleaned.\n\n` +
				  `Extract the clean brand name from this string: ${merchant}`,
			  },
		],
		temperature:0,
	}));
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
export async function categorizeMerchant(env:Env, merchant:string): Promise<Category> { // Categorize merchant using AI

	const cleaned = merchant.trim();
	if (!cleaned) return "Other";

	const cached = await env.DB
    .prepare("SELECT category FROM merchant_category_cache WHERE merchant = ?1")
    .bind(cleaned)
    .first<{ category: string }>();

 	if (cached?.category && isCategory(cached.category)) return cached.category;


	const result = await aiRunWithRetry(() => env.AI.run("@cf/meta/llama-3.1-70b-instruct" as any, {  // Llama 3.1 70b
		
		messages:[
			{
				role: "system",
        		content:
          		"You are a financial classification engine. Categorize the merchant into ONE of these categories: " + allowedCategories.join(", ") + ".\n\n" +
     			 "DETERMINATION RULES:\n" +
      			"1. RETAIL CLUES: If the name contains 'Store', 'Shop', 'Market', 'Boutique', or 'Goods', prioritize 'Shopping'.\n" +
     			 "2. DINING CLUES: If the name contains 'Bistro', 'Grill', 'Kitchen', 'Sushi', or 'Cafe', prioritize 'Food & Dining'.\n" +
      			"3. PROPER NOUN LOGIC: If the name is a standalone proper noun (e.g., 'MAKOTO', 'IBERICA', 'SHO-DAN') without retail keywords, it is statistically 90% more likely to be 'Food & Dining'.\n" +
    		    "4. DOUBT: If you cannot find any industry markers and the name sounds corporate (e.g., 'Global Industries'), use 'Other'.\n\n" +
      			"Return ONLY JSON: {\"category\":\"...\"}"
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
		
	
	}));
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
