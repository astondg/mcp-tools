import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { BudgetPeriod } from "@prisma/client";
import {
  ScenarioResponse,
  ScenarioCategoryOverrideResponse,
  ScenarioIncomeOverrideResponse,
  ScenarioDetailResponse,
  ScenarioSummary,
  ScenarioComparisonResponse,
  EffectiveBudgetCategory,
  EffectiveIncomeSource,
  CreateScenarioInput,
  SetCategoryOverrideInput,
  SetIncomeOverrideInput,
  CategoryDifference,
  IncomeDifference,
} from "./scenario-types";

// ==========================================
// Utility Functions
// ==========================================

function decimalToNumber(value: Decimal | null): number {
  return value ? value.toNumber() : 0;
}

/**
 * Convert budget amount to monthly equivalent
 */
function toMonthly(amount: number, period: BudgetPeriod): number {
  switch (period) {
    case "WEEKLY":
      return (amount * 52) / 12;
    case "FORTNIGHTLY":
      return (amount * 26) / 12;
    case "MONTHLY":
      return amount;
    case "QUARTERLY":
      return amount / 3;
    case "YEARLY":
      return amount / 12;
  }
}

/**
 * Convert budget amount to annual equivalent
 */
function toAnnual(amount: number, period: BudgetPeriod): number {
  switch (period) {
    case "WEEKLY":
      return amount * 52;
    case "FORTNIGHTLY":
      return amount * 26;
    case "MONTHLY":
      return amount * 12;
    case "QUARTERLY":
      return amount * 4;
    case "YEARLY":
      return amount;
  }
}

// ==========================================
// Scenario CRUD
// ==========================================

export async function createScenario(
  input: CreateScenarioInput
): Promise<ScenarioResponse> {
  const scenario = await prisma.budgetScenario.create({
    data: {
      name: input.name,
      description: input.description,
      isBaseline: false,
    },
    include: {
      _count: {
        select: {
          categoryOverrides: true,
          incomeOverrides: true,
        },
      },
    },
  });

  return {
    ...scenario,
    categoryOverrideCount: scenario._count.categoryOverrides,
    incomeOverrideCount: scenario._count.incomeOverrides,
  };
}

export async function getScenarios(): Promise<ScenarioResponse[]> {
  const scenarios = await prisma.budgetScenario.findMany({
    include: {
      _count: {
        select: {
          categoryOverrides: true,
          incomeOverrides: true,
        },
      },
    },
    orderBy: [{ isBaseline: "desc" }, { name: "asc" }],
  });

  return scenarios.map((s) => ({
    ...s,
    categoryOverrideCount: s._count.categoryOverrides,
    incomeOverrideCount: s._count.incomeOverrides,
  }));
}

export async function getScenarioById(id: string): Promise<ScenarioResponse | null> {
  const scenario = await prisma.budgetScenario.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          categoryOverrides: true,
          incomeOverrides: true,
        },
      },
    },
  });

  if (!scenario) return null;

  return {
    ...scenario,
    categoryOverrideCount: scenario._count.categoryOverrides,
    incomeOverrideCount: scenario._count.incomeOverrides,
  };
}

export async function getScenarioByName(name: string): Promise<ScenarioResponse | null> {
  const scenario = await prisma.budgetScenario.findUnique({
    where: { name },
    include: {
      _count: {
        select: {
          categoryOverrides: true,
          incomeOverrides: true,
        },
      },
    },
  });

  if (!scenario) return null;

  return {
    ...scenario,
    categoryOverrideCount: scenario._count.categoryOverrides,
    incomeOverrideCount: scenario._count.incomeOverrides,
  };
}

export async function deleteScenario(id: string): Promise<void> {
  // Prevent deleting baseline
  const scenario = await prisma.budgetScenario.findUnique({
    where: { id },
    select: { isBaseline: true },
  });

  if (scenario?.isBaseline) {
    throw new Error("Cannot delete the baseline scenario");
  }

  await prisma.budgetScenario.delete({ where: { id } });
}

export async function setBaseline(scenarioId: string): Promise<void> {
  await prisma.$transaction([
    // Clear existing baseline
    prisma.budgetScenario.updateMany({
      where: { isBaseline: true },
      data: { isBaseline: false },
    }),
    // Set new baseline
    prisma.budgetScenario.update({
      where: { id: scenarioId },
      data: { isBaseline: true },
    }),
  ]);
}

export async function getBaselineScenarioId(): Promise<string | null> {
  const baseline = await prisma.budgetScenario.findFirst({
    where: { isBaseline: true },
    select: { id: true },
  });
  return baseline?.id ?? null;
}

// ==========================================
// Override Operations
// ==========================================

export async function setCategoryOverride(
  input: SetCategoryOverrideInput
): Promise<ScenarioCategoryOverrideResponse> {
  // Find category by name
  const category = await prisma.budgetCategory.findUnique({
    where: { name: input.categoryName },
  });

  if (!category) {
    throw new Error(`Category "${input.categoryName}" not found`);
  }

  // Upsert the override
  const override = await prisma.scenarioCategoryOverride.upsert({
    where: {
      scenarioId_categoryId: {
        scenarioId: input.scenarioId,
        categoryId: category.id,
      },
    },
    update: {
      budgetAmount: input.budgetAmount,
      notes: input.notes,
    },
    create: {
      scenarioId: input.scenarioId,
      categoryId: category.id,
      budgetAmount: input.budgetAmount,
      notes: input.notes,
    },
    include: {
      category: {
        select: { name: true, period: true, budgetAmount: true },
      },
    },
  });

  const originalAmount = decimalToNumber(override.category.budgetAmount);
  const overrideAmount = decimalToNumber(override.budgetAmount);

  return {
    id: override.id,
    scenarioId: override.scenarioId,
    categoryId: override.categoryId,
    categoryName: override.category.name,
    originalAmount,
    overrideAmount,
    difference: overrideAmount - originalAmount,
    period: override.category.period,
    notes: override.notes,
    createdAt: override.createdAt,
  };
}

export async function setIncomeOverride(
  input: SetIncomeOverrideInput
): Promise<ScenarioIncomeOverrideResponse> {
  // Find income source by name
  const source = await prisma.incomeSource.findUnique({
    where: { name: input.sourceName },
  });

  if (!source) {
    throw new Error(`Income source "${input.sourceName}" not found`);
  }

  // Upsert the override
  const override = await prisma.scenarioIncomeOverride.upsert({
    where: {
      scenarioId_sourceId: {
        scenarioId: input.scenarioId,
        sourceId: source.id,
      },
    },
    update: {
      expectedAmount: input.expectedAmount,
      payDay: input.payDay,
      notes: input.notes,
    },
    create: {
      scenarioId: input.scenarioId,
      sourceId: source.id,
      expectedAmount: input.expectedAmount,
      payDay: input.payDay,
      notes: input.notes,
    },
    include: {
      source: {
        select: { name: true, expectedAmount: true, payDay: true },
      },
    },
  });

  const originalAmount = decimalToNumber(override.source.expectedAmount);
  const overrideAmount = decimalToNumber(override.expectedAmount);

  return {
    id: override.id,
    scenarioId: override.scenarioId,
    sourceId: override.sourceId,
    sourceName: override.source.name,
    originalAmount,
    overrideAmount,
    difference: overrideAmount - originalAmount,
    payDay: override.payDay ?? override.source.payDay,
    notes: override.notes,
    createdAt: override.createdAt,
  };
}

export async function removeCategoryOverride(
  scenarioId: string,
  categoryName: string
): Promise<void> {
  const category = await prisma.budgetCategory.findUnique({
    where: { name: categoryName },
    select: { id: true },
  });

  if (!category) {
    throw new Error(`Category "${categoryName}" not found`);
  }

  await prisma.scenarioCategoryOverride.delete({
    where: {
      scenarioId_categoryId: {
        scenarioId,
        categoryId: category.id,
      },
    },
  });
}

export async function removeIncomeOverride(
  scenarioId: string,
  sourceName: string
): Promise<void> {
  const source = await prisma.incomeSource.findUnique({
    where: { name: sourceName },
    select: { id: true },
  });

  if (!source) {
    throw new Error(`Income source "${sourceName}" not found`);
  }

  await prisma.scenarioIncomeOverride.delete({
    where: {
      scenarioId_sourceId: {
        scenarioId,
        sourceId: source.id,
      },
    },
  });
}

// ==========================================
// Effective Budget Calculations
// ==========================================

export async function getEffectiveBudgets(
  scenarioId: string
): Promise<EffectiveBudgetCategory[]> {
  // Get all active categories with their overrides for this scenario
  const categories = await prisma.budgetCategory.findMany({
    where: { isActive: true },
    include: {
      scenarioOverrides: {
        where: { scenarioId },
      },
    },
    orderBy: { name: "asc" },
  });

  return categories.map((cat) => {
    const originalAmount = decimalToNumber(cat.budgetAmount);
    const override = cat.scenarioOverrides[0];
    const overrideAmount = override ? decimalToNumber(override.budgetAmount) : null;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      period: cat.period,
      budgetAmount: overrideAmount ?? originalAmount,
      isOverridden: !!override,
      originalAmount,
    };
  });
}

export async function getEffectiveIncome(
  scenarioId: string
): Promise<EffectiveIncomeSource[]> {
  // Get all active income sources with their overrides for this scenario
  const sources = await prisma.incomeSource.findMany({
    where: { isActive: true },
    include: {
      scenarioOverrides: {
        where: { scenarioId },
      },
    },
    orderBy: { name: "asc" },
  });

  return sources.map((src) => {
    const originalAmount = decimalToNumber(src.expectedAmount);
    const override = src.scenarioOverrides[0];
    const overrideAmount = override ? decimalToNumber(override.expectedAmount) : null;

    return {
      sourceId: src.id,
      sourceName: src.name,
      expectedAmount: overrideAmount ?? originalAmount,
      payDay: override?.payDay ?? src.payDay,
      isOverridden: !!override,
      originalAmount,
    };
  });
}

// ==========================================
// Analysis Operations
// ==========================================

export async function getScenarioDetails(
  scenarioId: string
): Promise<ScenarioDetailResponse> {
  const scenario = await prisma.budgetScenario.findUnique({
    where: { id: scenarioId },
    include: {
      categoryOverrides: {
        include: {
          category: {
            select: { name: true, period: true, budgetAmount: true },
          },
        },
      },
      incomeOverrides: {
        include: {
          source: {
            select: { name: true, expectedAmount: true, payDay: true },
          },
        },
      },
    },
  });

  if (!scenario) {
    throw new Error("Scenario not found");
  }

  const categoryOverrides = scenario.categoryOverrides.map((o) => {
    const originalAmount = decimalToNumber(o.category.budgetAmount);
    const overrideAmount = decimalToNumber(o.budgetAmount);
    return {
      id: o.id,
      scenarioId: o.scenarioId,
      categoryId: o.categoryId,
      categoryName: o.category.name,
      originalAmount,
      overrideAmount,
      difference: overrideAmount - originalAmount,
      period: o.category.period,
      notes: o.notes,
      createdAt: o.createdAt,
    };
  });

  const incomeOverrides = scenario.incomeOverrides.map((o) => {
    const originalAmount = decimalToNumber(o.source.expectedAmount);
    const overrideAmount = decimalToNumber(o.expectedAmount);
    return {
      id: o.id,
      scenarioId: o.scenarioId,
      sourceId: o.sourceId,
      sourceName: o.source.name,
      originalAmount,
      overrideAmount,
      difference: overrideAmount - originalAmount,
      payDay: o.payDay ?? o.source.payDay,
      notes: o.notes,
      createdAt: o.createdAt,
    };
  });

  const summary = await getScenarioSummary(scenarioId);

  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    isBaseline: scenario.isBaseline,
    createdAt: scenario.createdAt,
    categoryOverrides,
    incomeOverrides,
    summary,
  };
}

export async function getScenarioSummary(scenarioId: string): Promise<ScenarioSummary> {
  const scenario = await prisma.budgetScenario.findUnique({
    where: { id: scenarioId },
    select: { name: true },
  });

  if (!scenario) {
    throw new Error("Scenario not found");
  }

  const [budgets, income] = await Promise.all([
    getEffectiveBudgets(scenarioId),
    getEffectiveIncome(scenarioId),
  ]);

  // Calculate monthly totals
  let monthlyExpenses = 0;
  for (const cat of budgets) {
    monthlyExpenses += toMonthly(cat.budgetAmount, cat.period);
  }

  // Income is already monthly (pay day based)
  const monthlyIncome = income.reduce((sum, src) => sum + src.expectedAmount, 0);
  const monthlySurplus = monthlyIncome - monthlyExpenses;

  return {
    scenarioId,
    scenarioName: scenario.name,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
    monthlySurplus: Math.round(monthlySurplus * 100) / 100,
    annualIncome: Math.round(monthlyIncome * 12 * 100) / 100,
    annualExpenses: Math.round(monthlyExpenses * 12 * 100) / 100,
    annualSurplus: Math.round(monthlySurplus * 12 * 100) / 100,
  };
}

export async function compareScenarios(
  scenarioId1: string,
  scenarioId2?: string
): Promise<ScenarioComparisonResponse> {
  // If no second scenario, use baseline
  let scenario2Id: string;
  if (scenarioId2) {
    scenario2Id = scenarioId2;
  } else {
    const baselineId = await getBaselineScenarioId();
    if (!baselineId) {
      throw new Error("No baseline scenario found for comparison");
    }
    scenario2Id = baselineId;
  }

  // Get summaries for both scenarios
  const [summary1, summary2] = await Promise.all([
    getScenarioSummary(scenarioId1),
    getScenarioSummary(scenario2Id),
  ]);

  // Get effective budgets for both scenarios
  const [budgets1, budgets2] = await Promise.all([
    getEffectiveBudgets(scenarioId1),
    getEffectiveBudgets(scenario2Id),
  ]);

  // Get effective income for both scenarios
  const [income1, income2] = await Promise.all([
    getEffectiveIncome(scenarioId1),
    getEffectiveIncome(scenario2Id),
  ]);

  // Build category differences
  const categoryDiffs: CategoryDifference[] = [];
  const allCategoryIds = new Set([
    ...budgets1.map((b) => b.categoryId),
    ...budgets2.map((b) => b.categoryId),
  ]);

  for (const catId of allCategoryIds) {
    const cat1 = budgets1.find((b) => b.categoryId === catId);
    const cat2 = budgets2.find((b) => b.categoryId === catId);

    if (cat1 || cat2) {
      const amount1 = cat1?.budgetAmount ?? 0;
      const amount2 = cat2?.budgetAmount ?? 0;
      const period = cat1?.period ?? cat2?.period ?? "MONTHLY";

      categoryDiffs.push({
        categoryId: catId,
        categoryName: cat1?.categoryName ?? cat2?.categoryName ?? "Unknown",
        period,
        scenario1Amount: amount1,
        scenario2Amount: amount2,
        difference: amount1 - amount2,
        monthlyDifference: toMonthly(amount1, period) - toMonthly(amount2, period),
      });
    }
  }

  // Sort by absolute monthly difference (largest first)
  categoryDiffs.sort(
    (a, b) => Math.abs(b.monthlyDifference) - Math.abs(a.monthlyDifference)
  );

  // Build income differences
  const incomeDiffs: IncomeDifference[] = [];
  const allSourceIds = new Set([
    ...income1.map((i) => i.sourceId),
    ...income2.map((i) => i.sourceId),
  ]);

  for (const srcId of allSourceIds) {
    const src1 = income1.find((i) => i.sourceId === srcId);
    const src2 = income2.find((i) => i.sourceId === srcId);

    if (src1 || src2) {
      const amount1 = src1?.expectedAmount ?? 0;
      const amount2 = src2?.expectedAmount ?? 0;

      incomeDiffs.push({
        sourceId: srcId,
        sourceName: src1?.sourceName ?? src2?.sourceName ?? "Unknown",
        scenario1Amount: amount1,
        scenario2Amount: amount2,
        difference: amount1 - amount2,
      });
    }
  }

  // Sort by absolute difference (largest first)
  incomeDiffs.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return {
    scenario1: summary1,
    scenario2: summary2,
    differences: {
      monthlyIncome: summary1.monthlyIncome - summary2.monthlyIncome,
      monthlyExpenses: summary1.monthlyExpenses - summary2.monthlyExpenses,
      monthlySurplus: summary1.monthlySurplus - summary2.monthlySurplus,
      annualIncome: summary1.annualIncome - summary2.annualIncome,
      annualExpenses: summary1.annualExpenses - summary2.annualExpenses,
      annualSurplus: summary1.annualSurplus - summary2.annualSurplus,
      categories: categoryDiffs,
      incomeSources: incomeDiffs,
    },
  };
}
