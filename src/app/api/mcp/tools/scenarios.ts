import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createScenario,
  getScenarios,
  deleteScenario,
  setBaseline,
  setCategoryOverride,
  setIncomeOverride,
  removeCategoryOverride,
  removeIncomeOverride,
  getScenarioDetails,
  getScenarioSummary,
  compareScenarios,
} from '@/lib/budget/scenario-queries';

export function registerScenarioTools(server: McpServer) {
  // Create a scenario
  server.tool(
    'scenario_create',
    'Create a new budget scenario for what-if analysis',
    {
      name: z.string().describe('Scenario name (e.g., "House Purchase", "New Job")'),
      description: z.string().optional().describe('Description of the scenario'),
    },
    async (params) => {
      try {
        const scenario = await createScenario({
          name: params.name,
          description: params.description,
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Scenario created: ${scenario.name}\n\n` +
                  `ID: ${scenario.id}\n` +
                  (scenario.description ? `Description: ${scenario.description}\n` : '') +
                  `\nUse scenario_set_category_budget and scenario_set_income to add overrides.`
          }]
        };
      } catch (error) {
        console.error('Error in scenario_create:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // List scenarios
  server.tool(
    'scenario_list',
    'List all budget scenarios',
    {},
    async () => {
      try {
        const scenarios = await getScenarios();

        if (scenarios.length === 0) {
          return { content: [{ type: 'text', text: 'No budget scenarios found. Use scenario_create to create one.' }] };
        }

        const lines = scenarios.map(s => {
          const status = s.isBaseline ? '⭐ Baseline' : '';
          return `${s.name} ${status}\n` +
                 `   ID: ${s.id}\n` +
                 `   Overrides: ${s.categoryOverrideCount} categories, ${s.incomeOverrideCount} income sources`;
        });

        return {
          content: [{ type: 'text', text: `📊 Budget Scenarios (${scenarios.length}):\n\n${lines.join('\n\n')}` }]
        };
      } catch (error) {
        console.error('Error in scenario_list:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Delete a scenario
  server.tool(
    'scenario_delete',
    'Delete a budget scenario',
    {
      scenarioId: z.string().describe('Scenario ID to delete'),
      confirm: z.boolean().describe('Confirm deletion'),
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return { content: [{ type: 'text', text: '⚠️ Please confirm deletion by setting confirm: true' }] };
        }

        await deleteScenario(params.scenarioId);
        return { content: [{ type: 'text', text: '✅ Scenario deleted.' }] };
      } catch (error) {
        console.error('Error in scenario_delete:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Set baseline scenario
  server.tool(
    'scenario_set_baseline',
    'Set a scenario as the baseline for comparisons',
    {
      scenarioId: z.string().describe('Scenario ID to set as baseline'),
    },
    async (params) => {
      try {
        await setBaseline(params.scenarioId);
        return { content: [{ type: 'text', text: '✅ Scenario set as baseline. Other scenarios will be compared against this.' }] };
      } catch (error) {
        console.error('Error in scenario_set_baseline:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Set category budget in scenario
  server.tool(
    'scenario_set_category_budget',
    'Set or update a category budget in a scenario',
    {
      scenarioId: z.string().describe('Scenario ID'),
      categoryName: z.string().describe('Budget category name'),
      budgetAmount: z.number().describe('New budget amount for this scenario'),
      notes: z.string().optional().describe('Notes about this override'),
    },
    async (params) => {
      try {
        const override = await setCategoryOverride({
          scenarioId: params.scenarioId,
          categoryName: params.categoryName,
          budgetAmount: params.budgetAmount,
          notes: params.notes,
        });

        const diff = override.difference;
        const diffStr = diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`;

        return {
          content: [{
            type: 'text',
            text: `✅ Category override set: ${override.categoryName}\n\n` +
                  `Original: $${override.originalAmount.toFixed(2)} (${override.period})\n` +
                  `Scenario: $${override.overrideAmount.toFixed(2)}\n` +
                  `Difference: ${diffStr}`
          }]
        };
      } catch (error) {
        console.error('Error in scenario_set_category_budget:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Set income in scenario
  server.tool(
    'scenario_set_income',
    'Set or update an income source in a scenario',
    {
      scenarioId: z.string().describe('Scenario ID'),
      sourceName: z.string().describe('Income source name'),
      expectedAmount: z.number().describe('New expected amount for this scenario'),
      payDay: z.number().int().min(1).max(31).optional().describe('Override pay day'),
      notes: z.string().optional().describe('Notes about this override'),
    },
    async (params) => {
      try {
        const override = await setIncomeOverride({
          scenarioId: params.scenarioId,
          sourceName: params.sourceName,
          expectedAmount: params.expectedAmount,
          payDay: params.payDay,
          notes: params.notes,
        });

        const diff = override.difference;
        const diffStr = diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`;

        return {
          content: [{
            type: 'text',
            text: `✅ Income override set: ${override.sourceName}\n\n` +
                  `Original: $${override.originalAmount.toFixed(2)}/month\n` +
                  `Scenario: $${override.overrideAmount.toFixed(2)}/month\n` +
                  `Difference: ${diffStr}`
          }]
        };
      } catch (error) {
        console.error('Error in scenario_set_income:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Remove category override
  server.tool(
    'scenario_remove_category_override',
    'Remove a category override from a scenario (revert to baseline)',
    {
      scenarioId: z.string().describe('Scenario ID'),
      categoryName: z.string().describe('Category name to remove override for'),
    },
    async (params) => {
      try {
        await removeCategoryOverride(params.scenarioId, params.categoryName);
        return { content: [{ type: 'text', text: `✅ Category override removed for "${params.categoryName}"` }] };
      } catch (error) {
        console.error('Error in scenario_remove_category_override:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Remove income override
  server.tool(
    'scenario_remove_income_override',
    'Remove an income override from a scenario (revert to baseline)',
    {
      scenarioId: z.string().describe('Scenario ID'),
      sourceName: z.string().describe('Income source name to remove override for'),
    },
    async (params) => {
      try {
        await removeIncomeOverride(params.scenarioId, params.sourceName);
        return { content: [{ type: 'text', text: `✅ Income override removed for "${params.sourceName}"` }] };
      } catch (error) {
        console.error('Error in scenario_remove_income_override:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get scenario details
  server.tool(
    'scenario_get_details',
    'Get full details of a scenario including all overrides',
    {
      scenarioId: z.string().describe('Scenario ID'),
    },
    async (params) => {
      try {
        const details = await getScenarioDetails(params.scenarioId);

        let output = `📊 Scenario: ${details.name}`;
        if (details.isBaseline) output += ' ⭐ (Baseline)';
        output += '\n';
        if (details.description) output += `${details.description}\n`;
        output += '\n';

        // Summary
        output += `💰 Monthly Summary:\n`;
        output += `   Income: $${details.summary.monthlyIncome.toFixed(2)}\n`;
        output += `   Expenses: $${details.summary.monthlyExpenses.toFixed(2)}\n`;
        output += `   Surplus: $${details.summary.monthlySurplus.toFixed(2)}\n`;
        output += `   Annual Surplus: $${details.summary.annualSurplus.toFixed(2)}\n\n`;

        // Category overrides
        if (details.categoryOverrides.length > 0) {
          output += `📁 Category Overrides (${details.categoryOverrides.length}):\n`;
          for (const o of details.categoryOverrides) {
            const diffStr = o.difference >= 0 ? `+$${o.difference.toFixed(2)}` : `-$${Math.abs(o.difference).toFixed(2)}`;
            output += `   ${o.categoryName}: $${o.overrideAmount.toFixed(2)} (${diffStr})\n`;
          }
          output += '\n';
        }

        // Income overrides
        if (details.incomeOverrides.length > 0) {
          output += `💵 Income Overrides (${details.incomeOverrides.length}):\n`;
          for (const o of details.incomeOverrides) {
            const diffStr = o.difference >= 0 ? `+$${o.difference.toFixed(2)}` : `-$${Math.abs(o.difference).toFixed(2)}`;
            output += `   ${o.sourceName}: $${o.overrideAmount.toFixed(2)} (${diffStr})\n`;
          }
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in scenario_get_details:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get scenario summary
  server.tool(
    'scenario_get_summary',
    'Get monthly income vs expense summary for a scenario',
    {
      scenarioId: z.string().describe('Scenario ID'),
    },
    async (params) => {
      try {
        const summary = await getScenarioSummary(params.scenarioId);

        return {
          content: [{
            type: 'text',
            text: `📊 ${summary.scenarioName} - Financial Summary\n\n` +
                  `Monthly:\n` +
                  `   Income: $${summary.monthlyIncome.toFixed(2)}\n` +
                  `   Expenses: $${summary.monthlyExpenses.toFixed(2)}\n` +
                  `   Surplus: $${summary.monthlySurplus.toFixed(2)}\n\n` +
                  `Annual:\n` +
                  `   Income: $${summary.annualIncome.toFixed(2)}\n` +
                  `   Expenses: $${summary.annualExpenses.toFixed(2)}\n` +
                  `   Surplus: $${summary.annualSurplus.toFixed(2)}`
          }]
        };
      } catch (error) {
        console.error('Error in scenario_get_summary:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Compare scenarios
  server.tool(
    'scenario_compare',
    'Compare two scenarios side by side',
    {
      scenarioId1: z.string().describe('First scenario ID to compare'),
      scenarioId2: z.string().optional().describe('Second scenario ID (defaults to baseline)'),
    },
    async (params) => {
      try {
        const comparison = await compareScenarios(params.scenarioId1, params.scenarioId2);

        let output = `📊 Scenario Comparison\n\n`;
        output += `${comparison.scenario1.scenarioName} vs ${comparison.scenario2.scenarioName}\n\n`;

        output += `Monthly Summary:\n`;
        output += `                    ${comparison.scenario1.scenarioName.substring(0, 15).padEnd(15)}  ${comparison.scenario2.scenarioName.substring(0, 15).padEnd(15)}  Difference\n`;
        output += `   Income:          $${comparison.scenario1.monthlyIncome.toFixed(0).padStart(10)}  $${comparison.scenario2.monthlyIncome.toFixed(0).padStart(10)}  ${comparison.differences.monthlyIncome >= 0 ? '+' : ''}$${comparison.differences.monthlyIncome.toFixed(0)}\n`;
        output += `   Expenses:        $${comparison.scenario1.monthlyExpenses.toFixed(0).padStart(10)}  $${comparison.scenario2.monthlyExpenses.toFixed(0).padStart(10)}  ${comparison.differences.monthlyExpenses >= 0 ? '+' : ''}$${comparison.differences.monthlyExpenses.toFixed(0)}\n`;
        output += `   Surplus:         $${comparison.scenario1.monthlySurplus.toFixed(0).padStart(10)}  $${comparison.scenario2.monthlySurplus.toFixed(0).padStart(10)}  ${comparison.differences.monthlySurplus >= 0 ? '+' : ''}$${comparison.differences.monthlySurplus.toFixed(0)}\n\n`;

        output += `Annual Impact:\n`;
        output += `   Surplus Diff: ${comparison.differences.annualSurplus >= 0 ? '+' : ''}$${comparison.differences.annualSurplus.toFixed(2)}\n\n`;

        // Top category differences
        const topCatDiffs = comparison.differences.categories
          .filter(c => Math.abs(c.monthlyDifference) > 0)
          .slice(0, 5);
        if (topCatDiffs.length > 0) {
          output += `Top Category Changes:\n`;
          for (const cat of topCatDiffs) {
            const sign = cat.monthlyDifference >= 0 ? '+' : '';
            output += `   ${cat.categoryName}: ${sign}$${cat.monthlyDifference.toFixed(2)}/month\n`;
          }
          output += '\n';
        }

        // Income differences
        const incomeDiffs = comparison.differences.incomeSources.filter(i => i.difference !== 0);
        if (incomeDiffs.length > 0) {
          output += `Income Changes:\n`;
          for (const inc of incomeDiffs) {
            const sign = inc.difference >= 0 ? '+' : '';
            output += `   ${inc.sourceName}: ${sign}$${inc.difference.toFixed(2)}/month\n`;
          }
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in scenario_compare:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );
}
