import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { BudgetPeriod, ExpenseSource, RuleMatchType } from '@prisma/client';
import type {
  BudgetCategoryResponse,
  ExpenseResponse,
  CategorizationRuleResponse,
  IncomeSourceResponse,
  IncomeResponse,
  BudgetSummaryResponse,
  BalanceResponse,
  ImportResult,
  CategorizationSuggestion,
  CategorySummary,
} from './types';

// Helper to convert Decimal to number
function decimalToNumber(value: Decimal | null): number {
  return value ? value.toNumber() : 0;
}

// Helper to get period date range
export function getPeriodDateRange(
  period: BudgetPeriod,
  startDate?: Date
): { start: Date; end: Date } {
  const now = startDate || new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case 'WEEKLY':
      // Start on Monday of current week
      const dayOfWeek = start.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setDate(start.getDate() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;

    case 'FORTNIGHTLY':
      // 14 days from start date
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 13);
      end.setHours(23, 59, 59, 999);
      break;

    case 'MONTHLY':
      // Current calendar month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0); // Last day of current month
      end.setHours(23, 59, 59, 999);
      break;

    case 'QUARTERLY':
      // Current quarter (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
      const quarter = Math.floor(start.getMonth() / 3);
      start.setMonth(quarter * 3);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth((quarter + 1) * 3);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'YEARLY':
      // Current calendar year
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11);
      end.setDate(31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

// ==========================================
// Budget Category Operations
// ==========================================

export async function upsertCategory(data: {
  name: string;
  period: BudgetPeriod;
  budgetAmount: number;
  parentName?: string;
}): Promise<BudgetCategoryResponse> {
  let parentId: string | null = null;
  let parentName: string | null = null;

  if (data.parentName) {
    const parent = await prisma.budgetCategory.findUnique({
      where: { name: data.parentName },
    });
    if (!parent) {
      throw new Error(`Parent category "${data.parentName}" not found`);
    }
    parentId = parent.id;
    parentName = parent.name;
  }

  const category = await prisma.budgetCategory.upsert({
    where: { name: data.name },
    create: {
      name: data.name,
      period: data.period,
      budgetAmount: data.budgetAmount,
      parentId,
    },
    update: {
      period: data.period,
      budgetAmount: data.budgetAmount,
      parentId,
    },
  });

  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId,
    parentName,
    period: category.period,
    budgetAmount: decimalToNumber(category.budgetAmount),
    isActive: category.isActive,
    createdAt: category.createdAt,
  };
}

export async function getCategories(filters: {
  period?: BudgetPeriod;
  activeOnly?: boolean;
}): Promise<BudgetCategoryResponse[]> {
  const categories = await prisma.budgetCategory.findMany({
    where: {
      period: filters.period,
      isActive: filters.activeOnly !== false ? true : undefined,
      parentId: null, // Get top-level categories
    },
    include: {
      children: {
        where: filters.activeOnly !== false ? { isActive: true } : undefined,
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    parentId: null,
    parentName: null,
    period: cat.period,
    budgetAmount: decimalToNumber(cat.budgetAmount),
    isActive: cat.isActive,
    createdAt: cat.createdAt,
    children: cat.children.map((child) => ({
      id: child.id,
      name: child.name,
      parentId: child.parentId,
      parentName: cat.name,
      period: child.period,
      budgetAmount: decimalToNumber(child.budgetAmount),
      isActive: child.isActive,
      createdAt: child.createdAt,
    })),
  }));
}

export async function deleteCategory(name: string): Promise<void> {
  const category = await prisma.budgetCategory.findUnique({
    where: { name },
    include: { expenses: { take: 1 } },
  });

  if (!category) {
    throw new Error(`Category "${name}" not found`);
  }

  if (category.expenses.length > 0) {
    throw new Error(`Cannot delete category "${name}" - it has expenses. Delete or reassign expenses first.`);
  }

  await prisma.budgetCategory.delete({
    where: { name },
  });
}

export async function getCategoryByName(name: string): Promise<BudgetCategoryResponse | null> {
  const category = await prisma.budgetCategory.findUnique({
    where: { name },
    include: { parent: true },
  });

  if (!category) return null;

  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId,
    parentName: category.parent?.name || null,
    period: category.period,
    budgetAmount: decimalToNumber(category.budgetAmount),
    isActive: category.isActive,
    createdAt: category.createdAt,
  };
}

// ==========================================
// Expense Operations
// ==========================================

export async function addExpense(data: {
  date: Date;
  amount: number;
  categoryName?: string;
  description: string;
  merchantName?: string;
  notes?: string;
  bankReference?: string;
  source?: ExpenseSource;
}): Promise<ExpenseResponse> {
  if (!data.categoryName) {
    throw new Error('Category name is required');
  }

  const category = await prisma.budgetCategory.findUnique({
    where: { name: data.categoryName },
  });
  if (!category) {
    throw new Error(`Category "${data.categoryName}" not found`);
  }
  const categoryId = category.id;
  const categoryName = category.name;

  const expense = await prisma.expense.create({
    data: {
      date: data.date,
      amount: data.amount,
      categoryId,
      description: data.description,
      merchantName: data.merchantName,
      notes: data.notes,
      bankReference: data.bankReference,
      source: data.source || 'MANUAL',
    },
  });

  return {
    id: expense.id,
    date: expense.date,
    amount: decimalToNumber(expense.amount),
    categoryId,
    categoryName,
    description: expense.description,
    merchantName: expense.merchantName,
    source: expense.source,
    bankReference: expense.bankReference,
    notes: expense.notes,
    createdAt: expense.createdAt,
  };
}

export async function getExpenses(filters: {
  startDate?: Date;
  endDate?: Date;
  categoryName?: string;
  minAmount?: number;
  maxAmount?: number;
  source?: ExpenseSource;
  limit?: number;
}): Promise<ExpenseResponse[]> {
  let categoryId: string | undefined;

  if (filters.categoryName) {
    const category = await prisma.budgetCategory.findUnique({
      where: { name: filters.categoryName },
    });
    if (category) {
      categoryId = category.id;
    }
  }

  const expenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
      categoryId,
      amount: {
        gte: filters.minAmount,
        lte: filters.maxAmount,
      },
      source: filters.source,
    },
    include: {
      category: true,
    },
    orderBy: { date: 'desc' },
    take: filters.limit ?? 50,
  });

  return expenses.map((exp) => ({
    id: exp.id,
    date: exp.date,
    amount: decimalToNumber(exp.amount),
    categoryId: exp.categoryId,
    categoryName: exp.category.name,
    description: exp.description,
    merchantName: exp.merchantName,
    source: exp.source,
    bankReference: exp.bankReference,
    notes: exp.notes,
    createdAt: exp.createdAt,
  }));
}

export async function updateExpense(
  id: string,
  data: {
    date?: Date;
    amount?: number;
    categoryName?: string;
    description?: string;
    notes?: string;
  }
): Promise<ExpenseResponse> {
  const updateData: Record<string, unknown> = {};

  if (data.date) updateData.date = data.date;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.description) updateData.description = data.description;
  if (data.notes !== undefined) updateData.notes = data.notes;

  if (data.categoryName) {
    const category = await prisma.budgetCategory.findUnique({
      where: { name: data.categoryName },
    });
    if (!category) {
      throw new Error(`Category "${data.categoryName}" not found`);
    }
    updateData.categoryId = category.id;
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: updateData,
    include: { category: true },
  });

  return {
    id: expense.id,
    date: expense.date,
    amount: decimalToNumber(expense.amount),
    categoryId: expense.categoryId,
    categoryName: expense.category.name,
    description: expense.description,
    merchantName: expense.merchantName,
    source: expense.source,
    bankReference: expense.bankReference,
    notes: expense.notes,
    createdAt: expense.createdAt,
  };
}

export async function deleteExpense(id: string): Promise<void> {
  await prisma.expense.delete({
    where: { id },
  });
}

// ==========================================
// CSV Import
// ==========================================

// Helper to match description against categorization rules (in-memory)
function matchCategory(
  description: string,
  rules: Array<{ id: string; pattern: string; matchType: RuleMatchType; categoryId: string; categoryName: string }>
): { categoryId: string; categoryName: string } | null {
  const descLower = description.toLowerCase();

  for (const rule of rules) {
    let matched = false;

    switch (rule.matchType) {
      case 'CONTAINS':
        matched = descLower.includes(rule.pattern.toLowerCase());
        break;
      case 'STARTS_WITH':
        matched = descLower.startsWith(rule.pattern.toLowerCase());
        break;
      case 'REGEX':
        try {
          const regex = new RegExp(rule.pattern, 'i');
          matched = regex.test(description);
        } catch {
          // Invalid regex, skip
        }
        break;
    }

    if (matched) {
      return { categoryId: rule.categoryId, categoryName: rule.categoryName };
    }
  }

  return null;
}

export async function importExpenses(data: {
  csvData: string;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  categoryColumn?: string;
  categories?: Array<{ description: string; category: string }>;
  skipHeader?: boolean;
}): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    uncategorized: [],
    errors: [],
  };

  const lines = data.csvData.trim().split('\n');
  if (lines.length === 0) {
    result.errors.push('No data found in CSV');
    return result;
  }

  // Parse header
  const header = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const dateIdx = header.indexOf(data.dateColumn);
  const amountIdx = header.indexOf(data.amountColumn);
  const descIdx = header.indexOf(data.descriptionColumn);
  const categoryIdx = data.categoryColumn ? header.indexOf(data.categoryColumn) : -1;

  if (dateIdx === -1) {
    result.errors.push(`Date column "${data.dateColumn}" not found in header`);
    return result;
  }
  if (amountIdx === -1) {
    result.errors.push(`Amount column "${data.amountColumn}" not found in header`);
    return result;
  }
  if (descIdx === -1) {
    result.errors.push(`Description column "${data.descriptionColumn}" not found in header`);
    return result;
  }
  if (data.categoryColumn && categoryIdx === -1) {
    result.errors.push(`Category column "${data.categoryColumn}" not found in header`);
    return result;
  }

  // Build a map of client-provided categories (description -> category name)
  const clientCategories = new Map<string, string>();
  if (data.categories) {
    for (const item of data.categories) {
      clientCategories.set(item.description.toLowerCase(), item.category);
    }
  }

  // Parse all rows first to collect bank references
  const startRow = data.skipHeader !== false ? 1 : 0;
  const parsedRows: Array<{
    rowNum: number;
    date: Date;
    amount: number;
    description: string;
    bankReference: string;
    dateStr: string;
    csvCategory?: string;
  }> = [];

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handles quoted values)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const dateStr = values[dateIdx];
    const amountStr = values[amountIdx]?.replace(/[$,]/g, '');
    const description = values[descIdx];

    if (!dateStr || !amountStr || !description) {
      result.errors.push(`Row ${i + 1}: Missing required fields`);
      continue;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      result.errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
      continue;
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      result.errors.push(`Row ${i + 1}: Invalid amount "${amountStr}"`);
      continue;
    }

    const expenseAmount = Math.abs(amount);
    const bankReference = `${dateStr}_${amountStr}_${description.substring(0, 50)}`;
    const csvCategory = categoryIdx >= 0 ? values[categoryIdx]?.trim() : undefined;

    parsedRows.push({
      rowNum: i + 1,
      date,
      amount: expenseAmount,
      description,
      bankReference,
      dateStr,
      csvCategory,
    });
  }

  if (parsedRows.length === 0) {
    return result;
  }

  // Pre-fetch all categorization rules for server-side fallback
  const rules = await prisma.categorizationRule.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { priority: 'desc' },
  });
  const rulesForMatching = rules.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    matchType: r.matchType,
    categoryId: r.categoryId,
    categoryName: r.category.name,
  }));

  // Pre-fetch all categories for name lookup
  const allCategories = await prisma.budgetCategory.findMany({
    select: { id: true, name: true },
  });
  const categoryByName = new Map(allCategories.map((c) => [c.name.toLowerCase(), c]));

  // Batch check for existing bank references
  const bankReferences = parsedRows.map((r) => r.bankReference);
  const existingExpenses = await prisma.expense.findMany({
    where: { bankReference: { in: bankReferences } },
    select: { bankReference: true },
  });
  const existingRefs = new Set(existingExpenses.map((e) => e.bankReference));

  // Prepare expenses to insert
  const expensesToCreate: Array<{
    date: Date;
    amount: number;
    categoryId: string;
    description: string;
    source: ExpenseSource;
    bankReference: string;
  }> = [];

  for (const row of parsedRows) {
    // Skip duplicates
    if (existingRefs.has(row.bankReference)) {
      result.skipped++;
      continue;
    }

    let categoryId: string | null = null;

    // 1. Try CSV category column first
    if (row.csvCategory) {
      const cat = categoryByName.get(row.csvCategory.toLowerCase());
      if (cat) {
        categoryId = cat.id;
      }
    }

    // 2. Try client-provided categories
    if (!categoryId) {
      const clientCat = clientCategories.get(row.description.toLowerCase());
      if (clientCat) {
        const cat = categoryByName.get(clientCat.toLowerCase());
        if (cat) {
          categoryId = cat.id;
        }
      }
    }

    // 3. Fall back to server-side rule matching
    if (!categoryId) {
      const match = matchCategory(row.description, rulesForMatching);
      if (match) {
        categoryId = match.categoryId;
      }
    }

    // If categorized, add to create list; otherwise add to uncategorized
    if (categoryId) {
      expensesToCreate.push({
        date: row.date,
        amount: row.amount,
        categoryId,
        description: row.description,
        source: 'BANK_IMPORT',
        bankReference: row.bankReference,
      });
    } else {
      result.uncategorized.push({
        description: row.description,
        amount: row.amount,
        date: row.dateStr,
      });
    }
  }

  // Bulk insert all categorized expenses
  if (expensesToCreate.length > 0) {
    await prisma.expense.createMany({
      data: expensesToCreate,
    });
    result.imported = expensesToCreate.length;
  }

  return result;
}

// ==========================================
// Categorization Rules
// ==========================================

export async function addCategorizationRule(data: {
  pattern: string;
  categoryName: string;
  matchType?: RuleMatchType;
  priority?: number;
}): Promise<CategorizationRuleResponse> {
  const category = await prisma.budgetCategory.findUnique({
    where: { name: data.categoryName },
  });

  if (!category) {
    throw new Error(`Category "${data.categoryName}" not found`);
  }

  const rule = await prisma.categorizationRule.create({
    data: {
      pattern: data.pattern,
      categoryId: category.id,
      matchType: data.matchType || 'CONTAINS',
      priority: data.priority || 0,
    },
    include: { category: true },
  });

  return {
    id: rule.id,
    pattern: rule.pattern,
    matchType: rule.matchType,
    categoryId: rule.categoryId,
    categoryName: rule.category.name,
    priority: rule.priority,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
  };
}

export async function getCategorizationRules(filters: {
  categoryName?: string;
}): Promise<CategorizationRuleResponse[]> {
  let categoryId: string | undefined;

  if (filters.categoryName) {
    const category = await prisma.budgetCategory.findUnique({
      where: { name: filters.categoryName },
    });
    if (category) {
      categoryId = category.id;
    }
  }

  const rules = await prisma.categorizationRule.findMany({
    where: {
      categoryId,
      isActive: true,
    },
    include: { category: true },
    orderBy: [{ priority: 'desc' }, { pattern: 'asc' }],
  });

  return rules.map((rule) => ({
    id: rule.id,
    pattern: rule.pattern,
    matchType: rule.matchType,
    categoryId: rule.categoryId,
    categoryName: rule.category.name,
    priority: rule.priority,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
  }));
}

export async function deleteCategorizationRule(id: string): Promise<void> {
  await prisma.categorizationRule.delete({
    where: { id },
  });
}

export async function suggestCategory(description: string): Promise<CategorizationSuggestion> {
  const rules = await prisma.categorizationRule.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { priority: 'desc' },
  });

  const descLower = description.toLowerCase();

  for (const rule of rules) {
    let matched = false;

    switch (rule.matchType) {
      case 'CONTAINS':
        matched = descLower.includes(rule.pattern.toLowerCase());
        break;
      case 'STARTS_WITH':
        matched = descLower.startsWith(rule.pattern.toLowerCase());
        break;
      case 'REGEX':
        try {
          const regex = new RegExp(rule.pattern, 'i');
          matched = regex.test(description);
        } catch {
          // Invalid regex, skip
        }
        break;
    }

    if (matched) {
      return {
        matched: true,
        categoryId: rule.categoryId,
        categoryName: rule.category.name,
        rule: {
          id: rule.id,
          pattern: rule.pattern,
          matchType: rule.matchType,
        },
      };
    }
  }

  return {
    matched: false,
    categoryId: null,
    categoryName: null,
    rule: null,
  };
}

// ==========================================
// Budget Analysis
// ==========================================

export async function getBudgetSummary(filters: {
  period: BudgetPeriod;
  startDate?: Date;
  categoryName?: string;
}): Promise<BudgetSummaryResponse> {
  const { start, end } = getPeriodDateRange(filters.period, filters.startDate);

  // Get categories for this period
  const categoryFilter: Record<string, unknown> = {
    period: filters.period,
    isActive: true,
  };

  if (filters.categoryName) {
    const cat = await prisma.budgetCategory.findUnique({
      where: { name: filters.categoryName },
    });
    if (cat) {
      categoryFilter.OR = [
        { id: cat.id },
        { parentId: cat.id },
      ];
    }
  }

  const categories = await prisma.budgetCategory.findMany({
    where: categoryFilter,
    include: {
      parent: true,
      children: {
        where: { isActive: true },
      },
      expenses: {
        where: {
          date: { gte: start, lte: end },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Build summary
  const summaries: CategorySummary[] = [];
  let totalBudgeted = 0;
  let totalActual = 0;

  // Process parent categories (no parentId)
  const parentCategories = categories.filter((c) => !c.parentId);

  for (const cat of parentCategories) {
    const budgetAmount = decimalToNumber(cat.budgetAmount);
    const actualAmount = cat.expenses.reduce(
      (sum, exp) => sum + decimalToNumber(exp.amount),
      0
    );

    // Get children summaries
    const childCategories = categories.filter((c) => c.parentId === cat.id);
    const childSummaries: CategorySummary[] = childCategories.map((child) => {
      const childBudget = decimalToNumber(child.budgetAmount);
      const childActual = child.expenses.reduce(
        (sum, exp) => sum + decimalToNumber(exp.amount),
        0
      );
      return {
        categoryId: child.id,
        categoryName: child.name,
        parentName: cat.name,
        period: child.period,
        budgetAmount: childBudget,
        actualAmount: childActual,
        variance: childBudget - childActual,
        percentUsed: childBudget > 0 ? (childActual / childBudget) * 100 : 0,
      };
    });

    // Parent totals include direct expenses + children
    const childActualTotal = childSummaries.reduce((sum, c) => sum + c.actualAmount, 0);
    const childBudgetTotal = childSummaries.reduce((sum, c) => sum + c.budgetAmount, 0);
    const totalActualForParent = actualAmount + childActualTotal;
    const totalBudgetForParent = budgetAmount + childBudgetTotal;

    summaries.push({
      categoryId: cat.id,
      categoryName: cat.name,
      parentName: null,
      period: cat.period,
      budgetAmount: totalBudgetForParent,
      actualAmount: totalActualForParent,
      variance: totalBudgetForParent - totalActualForParent,
      percentUsed: totalBudgetForParent > 0 ? (totalActualForParent / totalBudgetForParent) * 100 : 0,
      children: childSummaries.length > 0 ? childSummaries : undefined,
    });

    totalBudgeted += totalBudgetForParent;
    totalActual += totalActualForParent;
  }

  return {
    period: filters.period,
    startDate: start,
    endDate: end,
    categories: summaries,
    totals: {
      budgeted: totalBudgeted,
      actual: totalActual,
      variance: totalBudgeted - totalActual,
      percentUsed: totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0,
    },
  };
}

// ==========================================
// Income Operations
// ==========================================

export async function upsertIncomeSource(data: {
  name: string;
  expectedAmount: number;
  payDay: number;
}): Promise<IncomeSourceResponse> {
  const source = await prisma.incomeSource.upsert({
    where: { name: data.name },
    create: {
      name: data.name,
      expectedAmount: data.expectedAmount,
      payDay: data.payDay,
    },
    update: {
      expectedAmount: data.expectedAmount,
      payDay: data.payDay,
    },
  });

  return {
    id: source.id,
    name: source.name,
    expectedAmount: decimalToNumber(source.expectedAmount),
    payDay: source.payDay,
    isActive: source.isActive,
    createdAt: source.createdAt,
  };
}

export async function getIncomeSources(filters: {
  activeOnly?: boolean;
}): Promise<IncomeSourceResponse[]> {
  const sources = await prisma.incomeSource.findMany({
    where: filters.activeOnly !== false ? { isActive: true } : undefined,
    orderBy: { name: 'asc' },
  });

  return sources.map((src) => ({
    id: src.id,
    name: src.name,
    expectedAmount: decimalToNumber(src.expectedAmount),
    payDay: src.payDay,
    isActive: src.isActive,
    createdAt: src.createdAt,
  }));
}

export async function addIncome(data: {
  sourceName: string;
  date: Date;
  amount: number;
  description?: string;
  bankReference?: string;
}): Promise<IncomeResponse> {
  const source = await prisma.incomeSource.findUnique({
    where: { name: data.sourceName },
  });

  if (!source) {
    throw new Error(`Income source "${data.sourceName}" not found`);
  }

  const income = await prisma.income.create({
    data: {
      date: data.date,
      amount: data.amount,
      sourceId: source.id,
      description: data.description,
      bankReference: data.bankReference,
    },
    include: { source: true },
  });

  return {
    id: income.id,
    date: income.date,
    amount: decimalToNumber(income.amount),
    sourceId: income.sourceId,
    sourceName: income.source.name,
    description: income.description,
    bankReference: income.bankReference,
    createdAt: income.createdAt,
  };
}

export async function getIncome(filters: {
  startDate?: Date;
  endDate?: Date;
  sourceName?: string;
  limit?: number;
}): Promise<IncomeResponse[]> {
  let sourceId: string | undefined;

  if (filters.sourceName) {
    const source = await prisma.incomeSource.findUnique({
      where: { name: filters.sourceName },
    });
    if (source) {
      sourceId = source.id;
    }
  }

  const incomes = await prisma.income.findMany({
    where: {
      date: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
      sourceId,
    },
    include: { source: true },
    orderBy: { date: 'desc' },
    take: filters.limit ?? 50,
  });

  return incomes.map((inc) => ({
    id: inc.id,
    date: inc.date,
    amount: decimalToNumber(inc.amount),
    sourceId: inc.sourceId,
    sourceName: inc.source.name,
    description: inc.description,
    bankReference: inc.bankReference,
    createdAt: inc.createdAt,
  }));
}

// ==========================================
// Balance Analysis
// ==========================================

export async function getBalance(filters: {
  period: BudgetPeriod;
  startDate?: Date;
}): Promise<BalanceResponse> {
  const { start, end } = getPeriodDateRange(filters.period, filters.startDate);

  // Get expected income (sum of all active income sources)
  const incomeSources = await prisma.incomeSource.findMany({
    where: { isActive: true },
  });

  // Calculate expected income based on period
  let expectedIncome = 0;
  const monthlyExpected = incomeSources.reduce(
    (sum, src) => sum + decimalToNumber(src.expectedAmount),
    0
  );

  switch (filters.period) {
    case 'WEEKLY':
      expectedIncome = monthlyExpected / 4.33; // Approximate weeks per month
      break;
    case 'FORTNIGHTLY':
      expectedIncome = monthlyExpected / 2.17;
      break;
    case 'MONTHLY':
      expectedIncome = monthlyExpected;
      break;
    case 'QUARTERLY':
      expectedIncome = monthlyExpected * 3;
      break;
    case 'YEARLY':
      expectedIncome = monthlyExpected * 12;
      break;
  }

  // Get actual income for the period
  const actualIncomeResult = await prisma.income.aggregate({
    where: {
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  const actualIncome = decimalToNumber(actualIncomeResult._sum.amount);

  // Get budgeted expenses for this period
  const budgetCategories = await prisma.budgetCategory.findMany({
    where: {
      period: filters.period,
      isActive: true,
    },
  });
  const budgetedExpenses = budgetCategories.reduce(
    (sum, cat) => sum + decimalToNumber(cat.budgetAmount),
    0
  );

  // Get actual expenses for the period
  const actualExpenseResult = await prisma.expense.aggregate({
    where: {
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  const actualExpenses = decimalToNumber(actualExpenseResult._sum.amount);

  return {
    period: filters.period,
    startDate: start,
    endDate: end,
    income: {
      expected: expectedIncome,
      actual: actualIncome,
    },
    expenses: {
      budgeted: budgetedExpenses,
      actual: actualExpenses,
    },
    balance: {
      projected: expectedIncome - budgetedExpenses,
      actual: actualIncome - actualExpenses,
    },
  };
}
