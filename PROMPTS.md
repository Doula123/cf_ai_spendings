# AI Collaboration Log (PROMPTS.md)

- "How do I create a consolidated schema for my D1 database using my existing migrations?"
- "How do I apply migrations 0001 and 0002 to a new D1 database in a Cloudflare environment?"
- "My migrations include tables for `merchant_norm_cache`, `merchant_category_cache`, and `runs`. How do I verify these tables were created correctly using Wrangler?"
- "How can I test the Llama 3.3 normalization and categorization logic using a sample CSV format via the command line?"
- "How do I ensure the backend dev server uses the `--remote` flag to access Cloudflare's GPU network for AI features?"
- "Write the TypeScript interface for the D1 database rows to ensure type-safety when fetching from `merchant_norm_cache`.""
- "How do I implement a 'fallback' in the code so that if the Llama model fails, the app still returns the raw merchant name instead of crashing?"
- "How do I use `wrangler.jsonc` to define different environments (production vs. preview) for my D1 database and AI bindings?"
- "The Llama 3.3 model is sometimes returning markdown formatting in the JSON string. How can I refine the system prompt to ensure the output is strictly parseable JSON?"
- "Give me a diverse CSV dataset to test merchant normalization, categorization, and subscription detection."
- "What is the best way to verify that the D1 cache is actually saving results after the first AI analysis?"