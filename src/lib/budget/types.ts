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
