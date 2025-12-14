import { BudgetPeriod, ExpenseSource, RuleMatchType } from '@prisma/client';

// Re-export enums for convenience
export { BudgetPeriod, ExpenseSource, RuleMatchType };

// Budget periods for display
export const BUDGET_PERIODS = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

// Response types for tool outputs
export interface BudgetCategoryResponse {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  period: BudgetPeriod;
  budgetAmount: number;
  isActive: boolean;
  createdAt: Date;
  children?: BudgetCategoryResponse[];
}

export interface ExpenseResponse {
  id: string;
  date: Date;
  amount: number;
  categoryId: string;
  categoryName: string;
  description: string;
  merchantName: string | null;
  source: ExpenseSource;
  bankReference: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface CategorizationRuleResponse {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  categoryId: string;
  categoryName: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

export interface IncomeSourceResponse {
  id: string;
  name: string;
  expectedAmount: number;
  payDay: number;
  isActive: boolean;
  createdAt: Date;
}

export interface IncomeResponse {
  id: string;
  date: Date;
  amount: number;
  sourceId: string;
  sourceName: string;
  description: string | null;
  bankReference: string | null;
  createdAt: Date;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  parentName: string | null;
  period: BudgetPeriod;
  budgetAmount: number;
  actualAmount: number;
  variance: number; // positive = under budget, negative = over budget
  percentUsed: number;
  children?: CategorySummary[];
}

export interface BudgetSummaryResponse {
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  categories: CategorySummary[];
  totals: {
    budgeted: number;
    actual: number;
    variance: number;
    percentUsed: number;
  };
}

export interface BalanceResponse {
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  income: {
    expected: number;
    actual: number;
  };
  expenses: {
    budgeted: number;
    actual: number;
  };
  balance: {
    projected: number; // expected income - budgeted expenses
    actual: number; // actual income - actual expenses
  };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  uncategorized: Array<{
    description: string;
    amount: number;
    date: string;
  }>;
  errors: string[];
}

export interface CategorizationSuggestion {
  matched: boolean;
  categoryId: string | null;
  categoryName: string | null;
  rule: {
    id: string;
    pattern: string;
    matchType: RuleMatchType;
  } | null;
}

// Annual budget summary types
export interface AnnualCategorySummary {
  categoryId: string;
  categoryName: string;
  parentName: string | null;
  period: BudgetPeriod;
  periodBudget: number;          // Original budget per period
  annualizedBudget: number;      // Auto-calculated annual figure
  ytdActual: number;             // Year-to-date spending
  variance: number;              // annualizedBudget - ytdActual (positive = under budget)
  percentUsed: number;           // (ytdActual / annualizedBudget) * 100
  children?: AnnualCategorySummary[];
}

export interface AnnualBudgetSummaryResponse {
  year: number;
  startDate: Date;
  endDate: Date;
  categories: AnnualCategorySummary[];
  totals: {
    annualizedBudget: number;
    ytdActual: number;
    variance: number;
    percentUsed: number;
  };
}

// Expense totals types
export type ExpenseGroupBy = 'category' | 'month' | 'week';

export interface ExpenseTotalItem {
  groupKey: string;           // category name, "2024-01", or "2024-W01"
  groupLabel: string;         // Human-readable label
  total: number;
  count: number;
}

export interface ExpenseTotalsResponse {
  startDate: Date;
  endDate: Date;
  groupBy: ExpenseGroupBy;
  items: ExpenseTotalItem[];
  grandTotal: number;
  transactionCount: number;
}

// Income totals types
export type IncomeGroupBy = 'source' | 'month';

export interface IncomeTotalItem {
  groupKey: string;
  groupLabel: string;
  total: number;
  count: number;
}

export interface IncomeTotalsResponse {
  startDate: Date;
  endDate: Date;
  groupBy: IncomeGroupBy;
  items: IncomeTotalItem[];
  grandTotal: number;
  transactionCount: number;
}

// Budget vs Actuals comparison
export interface BudgetVsActualCategory {
  categoryId: string;
  categoryName: string;
  parentName: string | null;
  period: BudgetPeriod;
  periodBudget: number;
  annualizedBudget: number;
  ytdActual: number;
  variance: number;
  percentUsed: number;
  status: 'on_track' | 'warning' | 'over_budget';  // < 80% = on_track, 80-100% = warning, > 100% = over_budget
  children?: BudgetVsActualCategory[];
}

export interface BudgetVsActualsResponse {
  year: number;
  asOfDate: Date;
  daysElapsed: number;
  daysRemaining: number;
  categories: BudgetVsActualCategory[];
  totals: {
    annualizedBudget: number;
    ytdActual: number;
    variance: number;
    percentUsed: number;
    projectedYearEnd: number;   // Extrapolated based on current spending rate
    projectedVariance: number;  // Projected vs budgeted
  };
}

// Extended expense response with aggregates for search results
export interface ExpenseSearchResponse {
  expenses: ExpenseResponse[];
  aggregates: {
    totalAmount: number;
    count: number;
    averageAmount: number;
    minAmount: number;
    maxAmount: number;
  };
}

// Expense analytics types
export type ExpenseAnalyticsGroupBy = 'merchant' | 'category' | 'month' | 'week' | 'dayOfWeek';

export interface ExpenseAnalyticsItem {
  groupKey: string;
  groupLabel: string;
  total: number;
  count: number;
  average: number;
  percentOfTotal: number;
}

export interface ExpenseAnalyticsResponse {
  startDate: Date;
  endDate: Date;
  groupBy: ExpenseAnalyticsGroupBy;
  searchTerm?: string;
  items: ExpenseAnalyticsItem[];
  grandTotal: number;
  transactionCount: number;
}

// Spending insights types
export interface SpendingInsight {
  type: 'unusual_spending' | 'trending_up' | 'trending_down' | 'on_track' | 'over_budget' | 'top_merchant';
  severity: 'info' | 'warning' | 'alert';
  title: string;
  description: string;
  data: {
    amount?: number;
    percentChange?: number;
    category?: string;
    merchant?: string;
    period?: string;
  };
}

export interface SpendingInsightsResponse {
  period: string;
  startDate: Date;
  endDate: Date;
  insights: SpendingInsight[];
  summary: {
    totalSpent: number;
    averageDailySpend: number;
    topCategory: string;
    topMerchant: string;
    comparedToPreviousPeriod: number; // percentage change
  };
}

// Categorization suggestion for uncategorized expenses
export interface ExpenseCategorizationSuggestion {
  expenseId: string;
  description: string;
  amount: number;
  date: Date;
  suggestedCategory: string | null;
  suggestedCategoryId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedRule?: {
    pattern: string;
    matchType: string;
  };
  similarExpenses?: Array<{
    description: string;
    category: string;
  }>;
}
