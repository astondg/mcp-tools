import { z } from 'zod';
import { createMcpHandler } from '@vercel/mcp-adapter';
import { TokenStorage } from '@/lib/redis';

// Type definitions
interface FreelancerProject {
  id: number;
  title: string;
  budget?: {
    minimum?: number;
    maximum?: number;
    currency?: string;
  };
  jobs?: Array<{ name: string }>;
  bid_stats?: { bid_count: number };
  time_submitted?: number;
}

interface FreelancerBudget {
  minimum?: number;
  maximum?: number;
  currency?: string;
}

// Freelancer API helper functions
async function searchFreelancerProjects(
  token: string, 
  query: string, 
  minBudget?: number, 
  maxBudget?: number,
  projectType?: 'fixed' | 'hourly',
  limit: number = 10
) {
  // Use the active projects endpoint for better results
  const baseUrl = 'https://www.freelancer.com/api/projects/0.1/projects/active';
  const params = new URLSearchParams({
    query: query,
    limit: limit.toString(),
    compact: 'true'
  });

  // Add budget filters if provided
  if (minBudget) {
    params.append('min_avg_price', minBudget.toString());
  }
  if (maxBudget) {
    params.append('max_avg_price', maxBudget.toString());
  }

  // Add project type filter if provided
  if (projectType) {
    params.append('project_types[]', projectType);
  }

  const url = `${baseUrl}?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      'Freelancer-OAuth-V1': token,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Freelancer API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.result?.projects || data.projects || [];
}

function formatBudget(budget: FreelancerBudget | undefined) {
  if (!budget) return 'Not specified';
  
  if (budget.minimum && budget.maximum) {
    return `$${budget.minimum}-$${budget.maximum} ${budget.currency || 'USD'}`;
  } else if (budget.minimum) {
    return `$${budget.minimum}+ ${budget.currency || 'USD'}`;
  } else if (budget.maximum) {
    return `Up to $${budget.maximum} ${budget.currency || 'USD'}`;
  }
  
  return 'Budget not specified';
}

function formatTimeAgo(timestamp: number | undefined) {
  if (!timestamp) return 'Unknown';
  
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  
  if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diff / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
}

const handler = createMcpHandler(
  (server) => {
    // Freelancer project search tool
    server.tool(
      'search_freelancer_projects',
      'Search for freelancer projects based on keywords, budget, and other criteria',
      {
        query: z.string().min(1).describe('Search query for project titles/descriptions'),
        minBudget: z.number().int().min(0).optional().describe('Minimum average bid price in USD'),
        maxBudget: z.number().int().min(0).optional().describe('Maximum average bid price in USD'),
        projectType: z.enum(['fixed', 'hourly']).optional().describe('Project payment type: fixed or hourly'),
        limit: z.number().int().min(1).max(50).default(10).describe('Number of projects to return (1-50)')
      },
      async ({ query, minBudget, maxBudget, projectType, limit }) => {
        try {
          // Check if user is authenticated
          const token = await TokenStorage.getFreelancerToken();
          
          if (!token) {
            return {
              content: [{
                type: 'text',
                text: '🔒 Authentication required. Please visit the auth page to connect your Freelancer account:\n\n' +
                      'Visit: /auth to connect your account'
              }]
            };
          }

          // Call Freelancer API to search for projects
          const projects = await searchFreelancerProjects(token, query, minBudget, maxBudget, projectType, limit);
          
          if (!projects || projects.length === 0) {
            return {
              content: [{
                type: 'text',
                text: `No projects found matching "${query}". Try different keywords or broader search terms.`
              }]
            };
          }

          const budgetFilter = minBudget || maxBudget ? 
            ` (Budget: $${minBudget || 0}-${maxBudget || '∞'})` : '';
          const typeFilter = projectType ? ` (Type: ${projectType})` : '';

          const projectsList = projects.map((p: FreelancerProject) => {
            const budget = formatBudget(p.budget);
            const skills = p.jobs?.map((job) => job.name).slice(0, 3).join(', ') || 'Not specified';
            const timePosted = formatTimeAgo(p.time_submitted);
            
            return `• ${p.title}\n  Budget: ${budget}\n  Skills: ${skills}\n  Bids: ${p.bid_stats?.bid_count || 0}\n  Posted: ${timePosted}`;
          }).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `✅ Found ${projects.length} project(s) matching "${query}"${budgetFilter}${typeFilter}:\n\n${projectsList}\n\n🔗 Search performed using Freelancer.com API`
            }]
          };
          
        } catch (error) {
          console.error('Error in search_freelancer_projects:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error searching projects: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease try again or check your authentication.`
            }]
          };
        }
      },
    );
  },
  {},
  { 
    basePath: '/api' 
  },
);

export { handler as GET, handler as POST, handler as DELETE };