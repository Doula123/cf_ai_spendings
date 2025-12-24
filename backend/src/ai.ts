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


  export async function normalizedMerchant(env:Env, merchantRaw:string): Promise<string> { 
    
    const merchant = merchantRaw.trim();
    if (!merchant) return merchantRaw;

    // 1. Check Cache
    const cached = await env.DB.prepare("SELECT normalized_merchant FROM merchant_norm_cache WHERE raw_merchant = ?1")
                                .bind(merchant)
                                .first<{normalized_merchant:string}>();

    if (cached?.normalized_merchant) return cached.normalized_merchant;

    // 2. Call AI
    const result = await aiRunWithRetry(() => env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any, 
    {
        messages:[ 
            {
                role: "system", 
                content: `You are a helper that cleans merchant names.
				RULES:
				1. Remove transaction codes (#123, *882), URLs, and city/province names.
				2. If the input is "SQ *NAME", return "NAME".
				3. Strip "noise" words like "INC", "CORP", "LTD".
				4. KEEP meaningful words like "Coffee", "Market", "Foods".
				5. Always put acronyms in all CAPS.

				EXAMPLES:
				- "UBER CANADA/UBER TRIP TORONTO ON" -> {"normalizedMerchant": "Uber"}
				- "SQ *REVELSTOKE COFFEE LOND" -> {"normalizedMerchant": "Revelstoke Coffee"}
				- "ANYTIME FITNESS888-8279262" -> {"normalizedMerchant": "Anytime Fitness"}

				FINAL COMMAND: Output ONLY raw JSON. Use the key "normalizedMerchant".`
            },
            {
                role: "user", 
                content: `Normalize: "${merchant}"`,
            },
        ],
        temperature:0,
    }));

    // 3. Your Original Simple Parsing Logic
    console.log("AI raw result:", JSON.stringify(result));

    const wrapper = result as { response?: string | object };
    let parsed: { normalizedMerchant?: string } = {};

    if (wrapper.response) {
        if (typeof wrapper.response === 'object') {
            // CASE A: It is already an object (Llama 3.3 default) -> Use it directly
            parsed = wrapper.response as { normalizedMerchant?: string };
        } else if (typeof wrapper.response === 'string') {
            // CASE B: It is a string (Old Llama behavior) -> Parse it
            try {
                parsed = JSON.parse(wrapper.response);
            } catch (e) {
                console.error("Simple parse failed");
            }
        }
    }

    const out = (parsed.normalizedMerchant ?? "").trim() || merchant;

    // 4. Save Cache
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


	const result = await aiRunWithRetry(() => env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any, {  // Llama 3.1 70b
		
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
	const wrapper = result as { response?: string | object };
    let parsed: { category?: string } = {};

    if (wrapper.response) {
        if (typeof wrapper.response === 'object') {
            // CASE A: It is already an object (Llama 3.3 default)
            parsed = wrapper.response as { category?: string };
        } else if (typeof wrapper.response === 'string') {
            // CASE B: It is a string (Old/Fallback behavior)
            try {
                parsed = JSON.parse(wrapper.response);
            } catch (e) {
                console.error("Category parse failed");
            }
        }
    }

    const out = (parsed.category ?? "").trim();
    const finalCat: Category = isCategory(out) ? out : "Other";

  	// 3) save cache
  	await env.DB
    .prepare("INSERT OR REPLACE INTO merchant_category_cache (merchant, category) VALUES (?1, ?2)")
    .bind(cleaned, finalCat)
    .run();

  	return finalCat;
}
