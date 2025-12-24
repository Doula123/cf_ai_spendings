

export type Category = 
  | "Entertainment" 
  | "Food & Drink" 
  | "Fitness" 
  | "Shopping" 
  | "Travel" 
  | "Bills" 
  | "Other";


export type CategorizedTransaction = {
  date: string | null;
  merchant: string;
  centsAmount: number;
  category: Category;
};


export type Subscription = {
  merchant: string;
  cadence: "weekly" | "biweekly" | "monthly" | "yearly";
  averageCents: number;
  count: number;
  lastDate: string;
  avgGapDays: number;
};


export type RunResult = {
 
  categorized: CategorizedTransaction[];
  
  
  subscriptions: Subscription[];
  

  summary: {
    totalCents: number;
    byCategoryCents: Record<Category, number>;
    byMerchantCents: Record<string, number>; 
    topMerchants: Array<{ merchant: string; cents: number }>;
  };


  monthlySummary: {
    byMonthCents: Record<string, number>;
    byMonthCategoryCents: Record<string, Record<Category, number>>; 
  };

  warnings: string[];
  inputText?: string;
};


export type AnalyzerStatus = "idle" | "running" | "completed" | "error";