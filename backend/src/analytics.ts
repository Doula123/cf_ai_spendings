import type { Env, 
             AnalyzeRequest, 
             NormalizedTransaction,
             PossibleSubscriptions, 
             CategorizedTransaction, 
             Summary, 
             MonthlySummary,
             Category,
             } from "./types";
import { allowedCategories } from "./types";


             export function summaryBuilder(categorized: CategorizedTransaction[]): Summary{
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
            
            export function monthSummaryBuilder(categorized: CategorizedTransaction[]): MonthlySummary {
            
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
            export function monthKey(date:string): string {
                return date.slice(0, 7); // YYYY-MM
            }
            export function isCategory(x: string): x is Category {
            
                return allowedCategories.includes(x as Category);
                    }
            export function median (values: number[]):number{
            
                const sorted = [...values].sort((a, b) => a - b);
                const middle = Math.floor(sorted.length / 2);
                if (sorted.length % 2 === 1) return sorted[middle];
                return Math.round((sorted[middle-1] + sorted[middle]) / 2);
            }
            export function daysBetween(a:string, b:string): number {
                const dateA = new Date(a + "T00:00:00Z").getTime();
                const dateB = new Date(b + "T00:00:00Z").getTime();
                return Math.round(Math.abs(dateB - dateA) / (1000 * 60 * 60 * 24));
            }
            export function findSubscription(txns: NormalizedTransaction[]): PossibleSubscriptions[] {
            
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