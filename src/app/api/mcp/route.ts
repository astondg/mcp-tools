import { z } from 'zod';
import { createMcpHandler } from '@vercel/mcp-adapter';

const handler = createMcpHandler(
  (server) => {
    // Freelancer project search tool
    server.tool(
      'search_freelancer_projects',
      'Search for freelancer projects based on keywords, budget, and other criteria',
      {
        query: z.string().min(1).describe('Search query for project titles/descriptions'),
        minBudget: z.number().int().min(0).optional().describe('Minimum project budget in USD'),
        maxBudget: z.number().int().min(0).optional().describe('Maximum project budget in USD'),
        limit: z.number().int().min(1).max(50).default(10).describe('Number of projects to return (1-50)')
      },
      async ({ query, minBudget, maxBudget, limit }) => {
        // TODO: Implement actual Freelancer API integration
        // For now, return a mock response to test the structure
        const mockProjects = Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
          id: 12345 + i,
          title: `${query} - Project ${i + 1}`,
          description: 'This is a mock project description for testing purposes.',
          budget: { 
            min: Math.max(minBudget || 100, 500), 
            max: Math.min(maxBudget || 2000, 1500), 
            currency: 'USD' 
          },
          skills: ['JavaScript', 'React', 'Node.js'],
          bidsCount: 15 + i * 5,
          postedDate: new Date().toISOString()
        }));

        const budgetFilter = minBudget || maxBudget ? 
          ` (Budget filter: $${minBudget || 0}-${maxBudget || '∞'})` : '';

        return {
          content: [{
            type: 'text',
            text: `Found ${mockProjects.length} project(s) matching "${query}"${budgetFilter}:\n\n` +
                  mockProjects.map(p => 
                    `• ${p.title}\n  Budget: $${p.budget.min}-${p.budget.max}\n  Skills: ${p.skills.join(', ')}\n  Bids: ${p.bidsCount}`
                  ).join('\n\n') +
                  '\n\nNote: This is currently a mock response. API integration pending.'
          }]
        };
      },
    );
  },
  {},
  { 
    basePath: '/api' 
  },
);

export { handler as GET, handler as POST, handler as DELETE };