import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  addCategorizationRule,
  getCategorizationRules,
  deleteCategorizationRule,
  suggestCategory,
  getCategorizationSuggestions,
} from '@/lib/budget/queries';

export function registerCategorizationTools(server: McpServer): void {
  // Expense Categorization Suggestions
  server.tool(
    'expense_categorize_suggestions',
    'Get suggestions for categorizing uncategorized or miscellaneous expenses. Uses existing categorization rules and pattern matching from similar expenses to suggest categories. Great for cleaning up imported bank transactions.',
    {
      limit: z.number().int().min(1).max(50).optional().describe('Max suggestions to return (default: 20)'),
    },
    async (params) => {
      try {
        const suggestions = await getCategorizationSuggestions({
          limit: params.limit,
        });

        if (suggestions.length === 0) {
          return {
            content: [{ type: 'text', text: '✅ No uncategorized expenses found that need attention.' }]
          };
        }

        const confidenceIcon = (conf: string) => {
          switch (conf) {
            case 'high': return '✅';
            case 'medium': return '🟡';
            case 'low': return '🟠';
            default: return '❓';
          }
        };

        let response = `🏷️ **Categorization Suggestions** (${suggestions.length} expenses)\n\n`;

        for (const sugg of suggestions) {
          response += `**${sugg.description}**\n`;
          response += `• Amount: $${sugg.amount.toFixed(2)} | Date: ${sugg.date.toISOString().split('T')[0]}\n`;
          response += `• ID: ${sugg.expenseId}\n`;

          if (sugg.suggestedCategory) {
            response += `• ${confidenceIcon(sugg.confidence)} Suggested: **${sugg.suggestedCategory}** (${sugg.confidence} confidence)\n`;
            if (sugg.matchedRule) {
              response += `  Rule: "${sugg.matchedRule.pattern}" (${sugg.matchedRule.matchType})\n`;
            }
            if (sugg.similarExpenses && sugg.similarExpenses.length > 0) {
              response += `  Similar: ${sugg.similarExpenses.map(s => `"${s.description}" → ${s.category}`).join(', ')}\n`;
            }
          } else {
            response += `• ❓ No suggestion - consider creating a categorization rule\n`;
          }
          response += '\n';
        }

        response += `---\n`;
        response += `💡 Use \`expense_update\` to apply a category, or \`categorization_add_rule\` to create auto-categorization rules.`;

        return {
          content: [{ type: 'text', text: response }]
        };
      } catch (error) {
        console.error('Error in expense_categorize_suggestions:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Add categorization rule
  server.tool(
    'categorization_add_rule',
    'Add an auto-categorization rule for expense descriptions',
    {
      pattern: z.string().min(1).describe('Pattern to match (e.g., "Woolworths", "UBER EATS")'),
      category: z.string().min(1).describe('Category name to assign'),
      matchType: z.enum(['CONTAINS', 'STARTS_WITH', 'REGEX']).optional().describe('How to match the pattern (default: CONTAINS)'),
      priority: z.number().int().min(0).optional().describe('Higher priority rules are checked first (default: 0)'),
    },
    async (params) => {
      try {
        const rule = await addCategorizationRule({
          pattern: params.pattern,
          categoryName: params.category,
          matchType: params.matchType,
          priority: params.priority,
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Categorization rule added!\n\n` +
                  `• Pattern: "${rule.pattern}"\n` +
                  `• Match Type: ${rule.matchType}\n` +
                  `• Category: ${rule.categoryName}\n` +
                  `• Priority: ${rule.priority}`
          }]
        };
      } catch (error) {
        console.error('Error in categorization_add_rule:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get categorization rules
  server.tool(
    'categorization_get_rules',
    'List all auto-categorization rules',
    {
      category: z.string().optional().describe('Filter by category name'),
    },
    async (params) => {
      try {
        const rules = await getCategorizationRules({
          categoryName: params.category,
        });

        if (rules.length === 0) {
          return {
            content: [{ type: 'text', text: 'No categorization rules found. Use categorization_add_rule to create one.' }]
          };
        }

        const ruleList = rules.map(rule =>
          `• **"${rule.pattern}"** → ${rule.categoryName}\n` +
          `  Type: ${rule.matchType} | Priority: ${rule.priority}\n` +
          `  ID: ${rule.id}`
        ).join('\n\n');

        return {
          content: [{ type: 'text', text: `🏷️ Categorization Rules (${rules.length}):\n\n${ruleList}` }]
        };
      } catch (error) {
        console.error('Error in categorization_get_rules:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Delete categorization rule
  server.tool(
    'categorization_delete_rule',
    'Remove a categorization rule',
    {
      id: z.string().uuid().describe('Rule ID to delete'),
    },
    async (params) => {
      try {
        await deleteCategorizationRule(params.id);
        return {
          content: [{ type: 'text', text: '✅ Categorization rule deleted.' }]
        };
      } catch (error) {
        console.error('Error in categorization_delete_rule:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Suggest category
  server.tool(
    'categorization_suggest',
    'Test auto-categorization for a description without saving',
    {
      description: z.string().min(1).describe('Description to categorize'),
    },
    async (params) => {
      try {
        const suggestion = await suggestCategory(params.description);

        if (suggestion.matched) {
          return {
            content: [{
              type: 'text',
              text: `✅ Match found!\n\n` +
                    `• Category: ${suggestion.categoryName}\n` +
                    `• Matched by: "${suggestion.rule?.pattern}" (${suggestion.rule?.matchType})`
            }]
          };
        }

        return {
          content: [{ type: 'text', text: `❓ No matching rule found for: "${params.description}"\n\nUse categorization_add_rule to create a rule for this pattern.` }]
        };
      } catch (error) {
        console.error('Error in categorization_suggest:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );
}
