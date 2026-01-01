import { BudgetPeriod } from "@prisma/client";

// ==========================================
// Scenario Response Types
// ==========================================

export interface ScenarioResponse {
  id: string;
  name: string;
  description: string | null;
  isBaseline: boolean;
  createdAt: Date;
  updatedAt: Date;
  categoryOverrideCount: number;
  incomeOverrideCount: number;
}

export interface ScenarioCategoryOverrideResponse {
  id: string;
  scenarioId: string;
  categoryId: string;
  categoryName: string;
  originalAmount: number;
  overrideAmount: number;
  difference: number;
  period: BudgetPeriod;
  notes: string | null;
  createdAt: Date;
}

export interface ScenarioIncomeOverrideResponse {
  id: string;
  scenarioId: string;
  sourceId: string;
  sourceName: string;
  originalAmount: number;
  overrideAmount: number;
  difference: number;
  payDay: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface ScenarioDetailResponse {
  id: string;
  name: string;
  description: string | null;
  isBaseline: boolean;
  createdAt: Date;
  categoryOverrides: ScenarioCategoryOverrideResponse[];
  incomeOverrides: ScenarioIncomeOverrideResponse[];
  summary: ScenarioSummary;
}

// ==========================================
// Summary & Comparison Types
// ==========================================

export interface ScenarioSummary {
  scenarioId: string;
  scenarioName: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplus: number;
  annualIncome: number;
  annualExpenses: number;
  annualSurplus: number;
}

export interface CategoryDifference {
  categoryId: string;
  categoryName: string;
  period: BudgetPeriod;
  scenario1Amount: number;
  scenario2Amount: number;
  difference: number;
  monthlyDifference: number;
}

export interface IncomeDifference {
  sourceId: string;
  sourceName: string;
  scenario1Amount: number;
  scenario2Amount: number;
  difference: number;
}

export interface ScenarioComparisonResponse {
  scenario1: ScenarioSummary;
  scenario2: ScenarioSummary;
  differences: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlySurplus: number;
    annualIncome: number;
    annualExpenses: number;
    annualSurplus: number;
    categories: CategoryDifference[];
    incomeSources: IncomeDifference[];
  };
}

// ==========================================
// Effective Budget Types (for calculations)
// ==========================================

export interface EffectiveBudgetCategory {
  categoryId: string;
  categoryName: string;
  period: BudgetPeriod;
  budgetAmount: number;
  isOverridden: boolean;
  originalAmount: number;
}

export interface EffectiveIncomeSource {
  sourceId: string;
  sourceName: string;
  expectedAmount: number;
  payDay: number;
  isOverridden: boolean;
  originalAmount: number;
}

// ==========================================
// Input Types
// ==========================================

export interface CreateScenarioInput {
  name: string;
  description?: string;
  cloneFromBaseline?: boolean;
}

export interface SetCategoryOverrideInput {
  scenarioId: string;
  categoryName: string;
  budgetAmount: number;
  notes?: string;
}

export interface SetIncomeOverrideInput {
  scenarioId: string;
  sourceName: string;
  expectedAmount: number;
  payDay?: number;
  notes?: string;
}
