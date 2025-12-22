import type { Env, Category } from "./types";
import { allowedCategories } from "./types";
import { isCategory } from "./analytics";





export async function normalizedMerchant(env:Env, merchantRaw:string): Promise<string> { // Normalize merchant names using AI
	
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
export async function categorizeMerchant(env:Env, merchant:string): Promise<Category> { // Categorize merchant using AI

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
