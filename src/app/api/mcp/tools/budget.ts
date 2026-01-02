import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  upsertCategory,
  getCategories,
  deleteCategory,
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  importExpenses,
  getBudgetSummary,
  getBalance,
  upsertIncomeSource,
  getIncomeSources,
  addIncome,
  getIncome,
  deleteIncome,
  getAnnualBudgetSummary,
  getExpenseTotals,
  getIncomeTotals,
  getBudgetVsActuals,
  getExpenseAnalytics,
  getSpendingInsights,
} from '@/lib/budget/queries';
import type {
  ExpenseGroupBy,
  IncomeGroupBy,
  ExpenseAnalyticsGroupBy,
  ExpenseSearchResponse,
} from '@/lib/budget/types';
import { BUDGET_PERIODS } from '@/lib/budget/types';

export function registerBudgetTools(server: McpServer) {
  // ==========================================
  // Budget Category Tools
  // ==========================================

  // Set budget category
  server.tool(
    'budget_set_category',
    'Create or update a budget category with an amount for a specific period',
    {
      name: z.string().min(1).max(100).describe('Category name (e.g., "Groceries", "Utilities")'),
      period: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).describe(`Budget period: ${BUDGET_PERIODS.join(', ')}`),
      budgetAmount: z.number().min(0).describe('Budget amount for this period'),
      parentName: z.string().optional().describe('Parent category name for subcategories'),
    },
    async (params) => {
      try {
        const category = await upsertCategory({
          name: params.name,
          period: params.period,
          budgetAmount: params.budgetAmount,
          parentName: params.parentName,
        });

        return {
          content: [{
            type: 'text',
            text: `Budget category ${category.id ? 'updated' : 'created'}!\n\n` +
                  `* Name: ${category.name}\n` +
                  `* Period: ${category.period}\n` +
                  `* Amount: $${category.budgetAmount.toFixed(2)}\n` +
                  (category.parentName ? `* Parent: ${category.parentName}\n` : '')
          }]
        };
      } catch (error) {
        console.error('Error in budget_set_category:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get budget categories
  server.tool(
    'budget_get_categories',
    'List all budget categories with their amounts, optionally filtered by period',
    {
      period: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional().describe('Filter by period'),
      activeOnly: z.boolean().optional().describe('Only show active categories (default: true)'),
    },
    async (params) => {
      try {
        const categories = await getCategories(params);

        if (categories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No budget categories found. Use budget_set_category to create one.' }]
          };
        }

        const formatCategory = (cat: typeof categories[0], indent = '') => {
          let line = `${indent}* **${cat.name}** (${cat.period})\n`;
          line += `${indent}  ID: ${cat.id}\n`;
          line += `${indent}  Budget: $${cat.budgetAmount.toFixed(2)}\n`;
          if (cat.children && cat.children.length > 0) {
            cat.children.forEach(child => {
              line += formatCategory(child, indent + '  ');
            });
          }
          return line;
        };

        const categoryList = categories.map(cat => formatCategory(cat)).join('\n');

        return {
          content: [{ type: 'text', text: `Budget Categories:\n\n${categoryList}` }]
        };
      } catch (error) {
        console.error('Error in budget_get_categories:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // List category names (machine-readable for scripts/parsers)
  server.tool(
    'budget_list_category_names',
    'Get a simple list of all budget category names (for scripts and parsers)',
    {
      activeOnly: z.boolean().optional().describe('Only show active categories (default: true)'),
    },
    async (params) => {
      try {
        const categories = await getCategories({ activeOnly: params.activeOnly });

        // Flatten categories including children
        const names: string[] = [];
        const collectNames = (cats: typeof categories) => {
          for (const cat of cats) {
            names.push(cat.name);
            if (cat.children) {
              for (const child of cat.children) {
                names.push(child.name);
              }
            }
          }
        };
        collectNames(categories);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ categories: names.sort() }, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in budget_list_category_names:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }) }]
        };
      }
    }
  );

  // Delete budget category
  server.tool(
    'budget_delete_category',
    'Delete a budget category (fails if expenses exist)',
    {
      name: z.string().min(1).describe('Category name to delete'),
    },
    async (params) => {
      try {
        await deleteCategory(params.name);
        return {
          content: [{ type: 'text', text: `Category "${params.name}" deleted.` }]
        };
      } catch (error) {
        console.error('Error in budget_delete_category:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // ==========================================
  // Expense Tools
  // ==========================================

  // Add expense
  server.tool(
    'expense_add',
    'Record a single expense transaction',
    {
      date: z.string().describe('Expense date (YYYY-MM-DD)'),
      amount: z.number().min(0).describe('Expense amount'),
      category: z.string().describe('Category name'),
      description: z.string().min(1).describe('Description of the expense'),
      merchantName: z.string().optional().describe('Merchant/vendor name'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (params) => {
      try {
        const date = new Date(params.date);
        if (isNaN(date.getTime())) {
          return {
            content: [{ type: 'text', text: 'Invalid date format. Use YYYY-MM-DD.' }]
          };
        }

        const expense = await addExpense({
          date,
          amount: params.amount,
          categoryName: params.category,
          description: params.description,
          merchantName: params.merchantName,
          notes: params.notes,
        });

        return {
          content: [{
            type: 'text',
            text: `Expense recorded!\n\n` +
                  `* Date: ${expense.date.toISOString().split('T')[0]}\n` +
                  `* Amount: $${expense.amount.toFixed(2)}\n` +
                  `* Category: ${expense.categoryName}\n` +
                  `* Description: ${expense.description}\n` +
                  (expense.merchantName ? `* Merchant: ${expense.merchantName}\n` : '')
          }]
        };
      } catch (error) {
        console.error('Error in expense_add:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Import expenses from CSV
  server.tool(
    'expense_import',
    'Bulk import expenses from CSV data. Categories can be provided via CSV column, categories array, or server rules will be used as fallback.',
    {
      csvData: z.string().min(1).describe('Raw CSV data as a string'),
      dateColumn: z.string().describe('Name of the date column'),
      amountColumn: z.string().describe('Name of the amount column'),
      descriptionColumn: z.string().describe('Name of the description column'),
      categoryColumn: z.string().optional().describe('Name of the category column in CSV (if present)'),
      categories: z.array(z.object({
        description: z.string().describe('Expense description to match'),
        category: z.string().describe('Category name to assign'),
      })).optional().describe('Client-provided categories mapping descriptions to category names'),
      skipHeader: z.boolean().optional().describe('Skip the first row (default: true)'),
    },
    async (params) => {
      try {
        const result = await importExpenses(params);

        let response = `Import Results:\n\n`;
        response += `* Imported: ${result.imported}\n`;
        response += `* Skipped (duplicates): ${result.skipped}\n`;
        response += `* Uncategorized: ${result.uncategorized.length}\n`;

        if (result.errors.length > 0) {
          response += `\nErrors:\n`;
          result.errors.slice(0, 5).forEach(err => {
            response += `  * ${err}\n`;
          });
          if (result.errors.length > 5) {
            response += `  ... and ${result.errors.length - 5} more errors\n`;
          }
        }

        if (result.uncategorized.length > 0) {
          response += `\nUncategorized items (need manual categorization):\n`;
          result.uncategorized.slice(0, 10).forEach(item => {
            response += `  * ${item.date}: $${item.amount.toFixed(2)} - ${item.description.substring(0, 50)}\n`;
          });
          if (result.uncategorized.length > 10) {
            response += `  ... and ${result.uncategorized.length - 10} more items\n`;
          }
        }

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in expense_import:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get expenses
  server.tool(
    'expense_get',
    'Query expenses with filters for date range, category, amount, and text search. Use searchTerm to find expenses by merchant name or description (e.g., "pop mart", "costco"). Use includeAggregates=true to get totals without needing to sum manually.',
    {
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      category: z.string().optional().describe('Filter by category name'),
      minAmount: z.number().optional().describe('Minimum amount'),
      maxAmount: z.number().optional().describe('Maximum amount'),
      source: z.enum(['MANUAL', 'BANK_IMPORT']).optional().describe('Filter by source'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
      // New search parameters
      searchTerm: z.string().optional().describe('Search in both description AND merchantName (case-insensitive). Use this for queries like "how much did I spend at Pop Mart"'),
      merchantName: z.string().optional().describe('Search specifically in merchantName field (case-insensitive)'),
      descriptionSearch: z.string().optional().describe('Search specifically in description field (case-insensitive)'),
      includeAggregates: z.boolean().optional().describe('If true, returns totals (sum, count, avg, min, max) across ALL matching expenses (not just the returned limit). Great for "how much total" queries.'),
    },
    async (params) => {
      try {
        const result = await getExpenses({
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          categoryName: params.category,
          minAmount: params.minAmount,
          maxAmount: params.maxAmount,
          source: params.source,
          limit: params.limit,
          searchTerm: params.searchTerm,
          merchantName: params.merchantName,
          descriptionSearch: params.descriptionSearch,
          includeAggregates: params.includeAggregates,
        });

        // Handle aggregates response
        if (params.includeAggregates && 'aggregates' in result) {
          const searchResult = result as ExpenseSearchResponse;
          const expenses = searchResult.expenses;
          const agg = searchResult.aggregates;

          if (expenses.length === 0) {
            return {
              content: [{ type: 'text', text: 'No expenses found matching your criteria.' }]
            };
          }

          const expenseList = expenses.slice(0, 10).map(exp =>
            `* **${exp.date.toISOString().split('T')[0]}** - $${exp.amount.toFixed(2)}\n` +
            `  ${exp.description}` +
            (exp.merchantName ? ` (${exp.merchantName})` : '') +
            ` [${exp.categoryName}]`
          ).join('\n\n');

          const showingText = expenses.length > 10 ? ` (showing first 10 of ${expenses.length} returned)` : '';

          return {
            content: [{
              type: 'text',
              text: `**Expense Search Results**${params.searchTerm ? ` for "${params.searchTerm}"` : ''}\n\n` +
                    `**Aggregates (all ${agg.count} matching expenses):**\n` +
                    `* Total: **$${agg.totalAmount.toFixed(2)}**\n` +
                    `* Count: ${agg.count} transactions\n` +
                    `* Average: $${agg.averageAmount.toFixed(2)}\n` +
                    `* Range: $${agg.minAmount.toFixed(2)} - $${agg.maxAmount.toFixed(2)}\n\n` +
                    `**Sample Transactions**${showingText}:\n\n${expenseList}`
            }]
          };
        }

        // Standard response (array of expenses)
        if (!Array.isArray(result) || result.length === 0) {
          return {
            content: [{ type: 'text', text: 'No expenses found matching your criteria.' }]
          };
        }

        const total = result.reduce((sum, exp) => sum + exp.amount, 0);
        const expenseList = result.map(exp =>
          `* **${exp.date.toISOString().split('T')[0]}** - $${exp.amount.toFixed(2)}\n` +
          `  ID: ${exp.id}\n` +
          `  Category: ${exp.categoryName}\n` +
          `  ${exp.description}` +
          (exp.merchantName ? ` (${exp.merchantName})` : '')
        ).join('\n\n');

        return {
          content: [{
            type: 'text',
            text: `Expenses (${result.length} items, Total: $${total.toFixed(2)}):\n\n${expenseList}`
          }]
        };
      } catch (error) {
        console.error('Error in expense_get:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Update expense
  server.tool(
    'expense_update',
    'Modify an existing expense record',
    {
      id: z.string().uuid().describe('Expense ID to update'),
      date: z.string().optional().describe('New date (YYYY-MM-DD)'),
      amount: z.number().min(0).optional().describe('New amount'),
      category: z.string().optional().describe('New category name'),
      description: z.string().optional().describe('New description'),
      notes: z.string().optional().describe('New notes'),
    },
    async (params) => {
      try {
        const expense = await updateExpense(params.id, {
          date: params.date ? new Date(params.date) : undefined,
          amount: params.amount,
          categoryName: params.category,
          description: params.description,
          notes: params.notes,
        });

        return {
          content: [{
            type: 'text',
            text: `Expense updated!\n\n` +
                  `* Date: ${expense.date.toISOString().split('T')[0]}\n` +
                  `* Amount: $${expense.amount.toFixed(2)}\n` +
                  `* Category: ${expense.categoryName}\n` +
                  `* Description: ${expense.description}`
          }]
        };
      } catch (error) {
        console.error('Error in expense_update:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Delete expense
  server.tool(
    'expense_delete',
    'Remove an expense record',
    {
      id: z.string().uuid().describe('Expense ID to delete'),
    },
    async (params) => {
      try {
        await deleteExpense(params.id);
        return {
          content: [{ type: 'text', text: 'Expense deleted.' }]
        };
      } catch (error) {
        console.error('Error in expense_delete:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // ==========================================
  // Budget Summary Tools
  // ==========================================

  // Get budget summary
  server.tool(
    'budget_get_summary',
    'Get spending vs budget analysis by category for a period',
    {
      period: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).describe('Budget period to analyze'),
      startDate: z.string().optional().describe('Custom start date (YYYY-MM-DD)'),
      category: z.string().optional().describe('Focus on a specific category'),
    },
    async (params) => {
      try {
        const summary = await getBudgetSummary({
          period: params.period,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          categoryName: params.category,
        });

        let response = `Budget Summary (${summary.period})\n`;
        response += `Period: ${summary.startDate.toISOString().split('T')[0]} to ${summary.endDate.toISOString().split('T')[0]}\n\n`;

        const formatVariance = (variance: number) => {
          if (variance >= 0) return `$${variance.toFixed(2)} under`;
          return `$${Math.abs(variance).toFixed(2)} over`;
        };

        summary.categories.forEach(cat => {
          response += `**${cat.categoryName}**\n`;
          response += `  Budget: $${cat.budgetAmount.toFixed(2)} | Spent: $${cat.actualAmount.toFixed(2)}\n`;
          response += `  ${formatVariance(cat.variance)} (${cat.percentUsed.toFixed(0)}%)\n`;

          if (cat.children && cat.children.length > 0) {
            cat.children.forEach(child => {
              response += `    * ${child.categoryName}: $${child.actualAmount.toFixed(2)} / $${child.budgetAmount.toFixed(2)}\n`;
            });
          }
          response += '\n';
        });

        response += `---\n`;
        response += `**TOTAL**: Budget $${summary.totals.budgeted.toFixed(2)} | Spent $${summary.totals.actual.toFixed(2)}\n`;
        response += `${formatVariance(summary.totals.variance)} (${summary.totals.percentUsed.toFixed(0)}% used)`;

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in budget_get_summary:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get balance
  server.tool(
    'budget_get_balance',
    'Get overall financial balance showing income vs expenses for a period',
    {
      period: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).describe('Period to analyze'),
      startDate: z.string().optional().describe('Custom start date (YYYY-MM-DD)'),
    },
    async (params) => {
      try {
        const balance = await getBalance({
          period: params.period,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
        });

        let response = `Financial Balance (${balance.period})\n`;
        response += `Period: ${balance.startDate.toISOString().split('T')[0]} to ${balance.endDate.toISOString().split('T')[0]}\n\n`;

        response += `**Income**\n`;
        response += `  Expected: $${balance.income.expected.toFixed(2)}\n`;
        response += `  Actual: $${balance.income.actual.toFixed(2)}\n\n`;

        response += `**Expenses**\n`;
        response += `  Budgeted: $${balance.expenses.budgeted.toFixed(2)}\n`;
        response += `  Actual: $${balance.expenses.actual.toFixed(2)}\n\n`;

        response += `**Balance**\n`;
        response += `  Projected: $${balance.balance.projected.toFixed(2)}\n`;
        response += `  Actual: $${balance.balance.actual.toFixed(2)}\n`;

        const actualStatus = balance.balance.actual >= 0 ? 'In the green!' : 'In deficit';
        response += `\n${actualStatus}`;

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in budget_get_balance:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // ==========================================
  // Income Tools
  // ==========================================

  // Set income source
  server.tool(
    'income_set_source',
    'Create or update an income source with expected amount and pay day',
    {
      name: z.string().min(1).max(100).describe('Income source name (e.g., "Hall & Willcox")'),
      expectedAmount: z.number().min(0).describe('Expected monthly income amount'),
      payDay: z.number().int().min(1).max(31).describe('Day of month for payment (1-31, use 31 for end of month)'),
    },
    async (params) => {
      try {
        const source = await upsertIncomeSource(params);

        return {
          content: [{
            type: 'text',
            text: `Income source configured!\n\n` +
                  `* Name: ${source.name}\n` +
                  `* Expected: $${source.expectedAmount.toFixed(2)}/month\n` +
                  `* Pay Day: ${source.payDay === 31 ? 'End of month' : `Day ${source.payDay}`}`
          }]
        };
      } catch (error) {
        console.error('Error in income_set_source:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get income sources
  server.tool(
    'income_get_sources',
    'List all configured income sources',
    {
      activeOnly: z.boolean().optional().describe('Only show active sources (default: true)'),
    },
    async (params) => {
      try {
        const sources = await getIncomeSources(params);

        if (sources.length === 0) {
          return {
            content: [{ type: 'text', text: 'No income sources found. Use income_set_source to add one.' }]
          };
        }

        const total = sources.reduce((sum, src) => sum + src.expectedAmount, 0);
        const sourceList = sources.map(src =>
          `* **${src.name}**\n` +
          `  ID: ${src.id}\n` +
          `  Expected: $${src.expectedAmount.toFixed(2)}/month\n` +
          `  Pay Day: ${src.payDay === 31 ? 'End of month' : `Day ${src.payDay}`}`
        ).join('\n\n');

        return {
          content: [{
            type: 'text',
            text: `Income Sources (Total: $${total.toFixed(2)}/month):\n\n${sourceList}`
          }]
        };
      } catch (error) {
        console.error('Error in income_get_sources:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Add income
  server.tool(
    'income_add',
    'Record actual income received',
    {
      source: z.string().min(1).describe('Income source name'),
      date: z.string().describe('Date received (YYYY-MM-DD)'),
      amount: z.number().min(0).describe('Amount received'),
      description: z.string().optional().describe('Additional description'),
      bankReference: z.string().optional().describe('Bank reference for deduplication'),
    },
    async (params) => {
      try {
        const date = new Date(params.date);
        if (isNaN(date.getTime())) {
          return {
            content: [{ type: 'text', text: 'Invalid date format. Use YYYY-MM-DD.' }]
          };
        }

        const income = await addIncome({
          sourceName: params.source,
          date,
          amount: params.amount,
          description: params.description,
          bankReference: params.bankReference,
        });

        return {
          content: [{
            type: 'text',
            text: `Income recorded!\n\n` +
                  `* Source: ${income.sourceName}\n` +
                  `* Date: ${income.date.toISOString().split('T')[0]}\n` +
                  `* Amount: $${income.amount.toFixed(2)}`
          }]
        };
      } catch (error) {
        console.error('Error in income_add:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get income
  server.tool(
    'income_get',
    'Query income records with filters',
    {
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      source: z.string().optional().describe('Filter by source name'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
    },
    async (params) => {
      try {
        const incomes = await getIncome({
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          sourceName: params.source,
          limit: params.limit,
        });

        if (incomes.length === 0) {
          return {
            content: [{ type: 'text', text: 'No income records found matching your criteria.' }]
          };
        }

        const total = incomes.reduce((sum, inc) => sum + inc.amount, 0);
        const incomeList = incomes.map(inc =>
          `* **${inc.date.toISOString().split('T')[0]}** - $${inc.amount.toFixed(2)}\n` +
          `  ID: ${inc.id}\n` +
          `  Source: ${inc.sourceName}` +
          (inc.description ? `\n  ${inc.description}` : '')
        ).join('\n\n');

        return {
          content: [{
            type: 'text',
            text: `Income Records (${incomes.length} items, Total: $${total.toFixed(2)}):\n\n${incomeList}`
          }]
        };
      } catch (error) {
        console.error('Error in income_get:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Delete income
  server.tool(
    'income_delete',
    'Delete an income record by ID',
    {
      id: z.string().min(1).describe('Income record ID to delete'),
    },
    async (params) => {
      try {
        await deleteIncome(params.id);
        return {
          content: [{ type: 'text', text: `Income record "${params.id}" deleted.` }]
        };
      } catch (error) {
        console.error('Error in income_delete:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // ==========================================
  // Aggregated Analysis Tools
  // ==========================================

  // Annual budget summary
  server.tool(
    'budget_get_annual_summary',
    'Get annualized budget totals with YTD spending for all categories. Auto-converts weekly/fortnightly/monthly/quarterly budgets to annual figures.',
    {
      year: z.number().int().min(2020).max(2100).optional().describe('Year to analyze (default: current year)'),
    },
    async (params) => {
      try {
        const summary = await getAnnualBudgetSummary({ year: params.year });

        let response = `Annual Budget Summary (${summary.year})\n`;
        response += `Period: ${summary.startDate.toISOString().split('T')[0]} to ${summary.endDate.toISOString().split('T')[0]}\n\n`;

        const formatVariance = (variance: number) => {
          if (variance >= 0) return `$${variance.toFixed(2)} under`;
          return `$${Math.abs(variance).toFixed(2)} over`;
        };

        for (const cat of summary.categories) {
          response += `**${cat.categoryName}** (${cat.period} -> Annual)\n`;
          response += `  Budget: $${cat.periodBudget.toFixed(2)}/${cat.period.toLowerCase()} = $${cat.annualizedBudget.toFixed(2)}/year\n`;
          response += `  YTD Actual: $${cat.ytdActual.toFixed(2)}\n`;
          response += `  ${formatVariance(cat.variance)} (${cat.percentUsed.toFixed(0)}% used)\n`;

          if (cat.children && cat.children.length > 0) {
            for (const child of cat.children) {
              response += `    * ${child.categoryName}: $${child.ytdActual.toFixed(2)} / $${child.annualizedBudget.toFixed(2)} (${child.percentUsed.toFixed(0)}%)\n`;
            }
          }
          response += '\n';
        }

        response += `---\n`;
        response += `**TOTALS**\n`;
        response += `  Annual Budget: $${summary.totals.annualizedBudget.toFixed(2)}\n`;
        response += `  YTD Spending: $${summary.totals.ytdActual.toFixed(2)}\n`;
        response += `  ${formatVariance(summary.totals.variance)} (${summary.totals.percentUsed.toFixed(0)}% used)`;

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in budget_get_annual_summary:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Expense totals by group
  server.tool(
    'expense_get_totals',
    'Get aggregated expense totals grouped by category, month, or week. Returns totals instead of individual transactions.',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      groupBy: z.enum(['category', 'month', 'week']).describe('How to group the results'),
    },
    async (params) => {
      try {
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            content: [{ type: 'text', text: 'Invalid date format. Use YYYY-MM-DD.' }]
          };
        }

        const totals = await getExpenseTotals({
          startDate: start,
          endDate: end,
          groupBy: params.groupBy as ExpenseGroupBy,
        });

        let response = `Expense Totals by ${params.groupBy}\n`;
        response += `Period: ${totals.startDate.toISOString().split('T')[0]} to ${totals.endDate.toISOString().split('T')[0]}\n\n`;

        if (totals.items.length === 0) {
          response += 'No expenses found for this period.\n';
        } else {
          for (const item of totals.items) {
            response += `**${item.groupLabel}**\n`;
            response += `  Total: $${item.total.toFixed(2)} (${item.count} transactions)\n`;
          }
        }

        response += `\n---\n`;
        response += `**Grand Total**: $${totals.grandTotal.toFixed(2)} (${totals.transactionCount} transactions)`;

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in expense_get_totals:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Income totals by group
  server.tool(
    'income_get_totals',
    'Get aggregated income totals grouped by source or month. Returns totals instead of individual transactions.',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      groupBy: z.enum(['source', 'month']).describe('How to group the results'),
    },
    async (params) => {
      try {
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            content: [{ type: 'text', text: 'Invalid date format. Use YYYY-MM-DD.' }]
          };
        }

        const totals = await getIncomeTotals({
          startDate: start,
          endDate: end,
          groupBy: params.groupBy as IncomeGroupBy,
        });

        let response = `Income Totals by ${params.groupBy}\n`;
        response += `Period: ${totals.startDate.toISOString().split('T')[0]} to ${totals.endDate.toISOString().split('T')[0]}\n\n`;

        if (totals.items.length === 0) {
          response += 'No income found for this period.\n';
        } else {
          for (const item of totals.items) {
            response += `**${item.groupLabel}**\n`;
            response += `  Total: $${item.total.toFixed(2)} (${item.count} payments)\n`;
          }
        }

        response += `\n---\n`;
        response += `**Grand Total**: $${totals.grandTotal.toFixed(2)} (${totals.transactionCount} payments)`;

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in income_get_totals:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Budget vs Actuals comparison
  server.tool(
    'budget_vs_actuals',
    'Get a complete budget vs actual spending comparison for every category. Shows annualized budgets, YTD spending, variance, status (on_track/warning/over_budget), and projected year-end figures.',
    {
      year: z.number().int().min(2020).max(2100).optional().describe('Year to analyze (default: current year)'),
    },
    async (params) => {
      try {
        const comparison = await getBudgetVsActuals({ year: params.year });

        const statusIcon = (status: string) => {
          switch (status) {
            case 'on_track': return '[OK]';
            case 'warning': return '[WARN]';
            case 'over_budget': return '[OVER]';
            default: return '[?]';
          }
        };

        let response = `Budget vs Actuals (${comparison.year})\n`;
        response += `As of: ${comparison.asOfDate.toISOString().split('T')[0]}\n`;
        response += `Progress: ${comparison.daysElapsed} days elapsed, ${comparison.daysRemaining} days remaining\n\n`;

        response += `| Category | Annual Budget | YTD Actual | Variance | % Used | Status |\n`;
        response += `|----------|---------------|------------|----------|--------|--------|\n`;

        for (const cat of comparison.categories) {
          const variance = cat.variance >= 0 ? `+$${cat.variance.toFixed(0)}` : `-$${Math.abs(cat.variance).toFixed(0)}`;
          response += `| **${cat.categoryName}** | $${cat.annualizedBudget.toFixed(0)} | $${cat.ytdActual.toFixed(0)} | ${variance} | ${cat.percentUsed.toFixed(0)}% | ${statusIcon(cat.status)} |\n`;

          if (cat.children && cat.children.length > 0) {
            for (const child of cat.children) {
              const childVariance = child.variance >= 0 ? `+$${child.variance.toFixed(0)}` : `-$${Math.abs(child.variance).toFixed(0)}`;
              response += `|   -> ${child.categoryName} | $${child.annualizedBudget.toFixed(0)} | $${child.ytdActual.toFixed(0)} | ${childVariance} | ${child.percentUsed.toFixed(0)}% | ${statusIcon(child.status)} |\n`;
            }
          }
        }

        response += `\n---\n`;
        response += `**SUMMARY**\n`;
        response += `* Annual Budget: $${comparison.totals.annualizedBudget.toFixed(2)}\n`;
        response += `* YTD Spending: $${comparison.totals.ytdActual.toFixed(2)} (${comparison.totals.percentUsed.toFixed(1)}%)\n`;
        response += `* Current Variance: ${comparison.totals.variance >= 0 ? '+' : '-'}$${Math.abs(comparison.totals.variance).toFixed(2)}\n`;
        response += `\n**PROJECTIONS**\n`;
        response += `* Projected Year-End Spending: $${comparison.totals.projectedYearEnd.toFixed(2)}\n`;
        response += `* Projected Variance: ${comparison.totals.projectedVariance >= 0 ? '+' : '-'}$${Math.abs(comparison.totals.projectedVariance).toFixed(2)}\n`;
        response += comparison.totals.projectedVariance >= 0 ? 'On track to stay under budget' : 'Projected to exceed budget';

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in budget_vs_actuals:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Expense Analytics - Advanced grouping and aggregation
  server.tool(
    'expense_analytics',
    'Get expense analytics with flexible grouping options. Perfect for questions like "top merchants by spend", "spending by day of week", "monthly trend for a merchant". Groups expenses and provides totals, counts, averages, and percentages.',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      groupBy: z.enum(['merchant', 'category', 'month', 'week', 'dayOfWeek']).describe('How to group results: merchant (by vendor/store), category, month, week, or dayOfWeek'),
      searchTerm: z.string().optional().describe('Optional: filter to expenses matching this term in description or merchantName'),
      category: z.string().optional().describe('Optional: filter to a specific category'),
      limit: z.number().int().min(1).max(50).optional().describe('Max groups to return (default: all). Use for "top 10" queries.'),
      sortBy: z.enum(['amount', 'count']).optional().describe('Sort by total amount (default) or transaction count'),
    },
    async (params) => {
      try {
        const analytics = await getExpenseAnalytics({
          startDate: new Date(params.startDate),
          endDate: new Date(params.endDate),
          groupBy: params.groupBy as ExpenseAnalyticsGroupBy,
          searchTerm: params.searchTerm,
          categoryName: params.category,
          limit: params.limit,
          sortBy: params.sortBy,
        });

        if (analytics.items.length === 0) {
          return {
            content: [{ type: 'text', text: 'No expenses found matching your criteria.' }]
          };
        }

        let response = `**Expense Analytics**${params.searchTerm ? ` (filtered: "${params.searchTerm}")` : ''}\n`;
        response += `Period: ${analytics.startDate.toISOString().split('T')[0]} to ${analytics.endDate.toISOString().split('T')[0]}\n`;
        response += `Grouped by: ${analytics.groupBy}\n\n`;

        response += `| ${analytics.groupBy === 'merchant' ? 'Merchant' : analytics.groupBy === 'category' ? 'Category' : 'Period'} | Total | Count | Avg | % of Total |\n`;
        response += `|----------|-------|-------|-----|------------|\n`;

        for (const item of analytics.items) {
          response += `| ${item.groupLabel} | $${item.total.toFixed(2)} | ${item.count} | $${item.average.toFixed(2)} | ${item.percentOfTotal.toFixed(1)}% |\n`;
        }

        response += `\n---\n`;
        response += `**Grand Total**: $${analytics.grandTotal.toFixed(2)} across ${analytics.transactionCount} transactions`;

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in expense_analytics:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Spending Insights - Automatic analysis and alerts
  server.tool(
    'budget_spending_insights',
    'Get AI-generated spending insights for a budget period. Returns alerts about unusual spending, budget warnings, top merchants, and trends compared to the previous period. Use this for proactive budget monitoring.',
    {
      period: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).describe('Budget period to analyze'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD) - defaults to current period'),
    },
    async (params) => {
      try {
        const insights = await getSpendingInsights({
          period: params.period,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
        });

        const severityIcon = (severity: string) => {
          switch (severity) {
            case 'alert': return '[ALERT]';
            case 'warning': return '[WARN]';
            case 'info': return '[INFO]';
            default: return '*';
          }
        };

        let response = `**Spending Insights** (${insights.period})\n`;
        response += `Period: ${insights.startDate.toISOString().split('T')[0]} to ${insights.endDate.toISOString().split('T')[0]}\n\n`;

        response += `**Summary**\n`;
        response += `* Total Spent: $${insights.summary.totalSpent.toFixed(2)}\n`;
        response += `* Daily Average: $${insights.summary.averageDailySpend.toFixed(2)}\n`;
        response += `* Top Category: ${insights.summary.topCategory}\n`;
        response += `* Top Merchant: ${insights.summary.topMerchant}\n`;
        response += `* vs Previous Period: ${insights.summary.comparedToPreviousPeriod >= 0 ? '+' : ''}${insights.summary.comparedToPreviousPeriod.toFixed(1)}%\n\n`;

        if (insights.insights.length > 0) {
          response += `**Insights & Alerts**\n`;
          for (const insight of insights.insights) {
            response += `${severityIcon(insight.severity)} **${insight.title}**\n`;
            response += `   ${insight.description}\n`;
          }
        } else {
          response += `No notable insights for this period - spending looks normal.`;
        }

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in budget_spending_insights:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );
}
