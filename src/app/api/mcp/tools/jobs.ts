import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerJobsTools(server: McpServer) {
  // Multi-provider remote job search tool
  server.tool(
    'search_remote_jobs',
    'Search for remote jobs across multiple providers (WeWorkRemotely, Remotive, Himalayas) with duplicate detection',
    {
      keywords: z.string().optional().describe('Job search keywords to filter results (e.g., "javascript", "react", "senior")'),
      category: z.enum(['all', 'programming', 'design', 'marketing', 'customer-support', 'sales', 'management']).default('all').describe('Job category filter'),
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of unique jobs to return (1-100)'),
      providers: z.array(z.enum(['weworkremotely', 'remotive', 'himalayas'])).default(['weworkremotely', 'remotive', 'himalayas']).describe('Job providers to search')
    },
    async ({ keywords, category, limit, providers }) => {
      try {
        type JobEntry = {
          title: string;
          company: string;
          location: string;
          url: string;
          description: string;
          pubDate: string;
          provider: string;
          category?: string;
          hash: string;
        };

        // Helper function to generate job hash for duplicate detection
        const generateJobHash = (title: string, company: string) => {
          const normalized = `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${company.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          return normalized;
        };

        // Helper function to parse RSS feed
        const parseRSSFeed = async (url: string, providerName: string): Promise<JobEntry[]> => {
          try {
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'MCP-Tools Remote Job Search/1.0'
              }
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const xmlText = await response.text();
            const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);

            if (!itemMatches) return [];

            return itemMatches.map(item => {
              // Extract title
              let titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
              let title = '';
              if (titleMatch) {
                title = titleMatch[1];
              } else {
                titleMatch = item.match(/<title>(.*?)<\/title>/);
                title = titleMatch ? titleMatch[1].replace(/&[^;]+;/g, ' ').trim() : '';
              }

              // Extract link
              const linkMatch = item.match(/<link>(.*?)<\/link>/);
              const url = linkMatch ? linkMatch[1] : '';

              // Extract description
              let descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
              let description = '';
              if (descMatch) {
                description = descMatch[1]
                  .replace(/<[^>]*>/g, '')
                  .replace(/&[^;]+;/g, ' ')
                  .trim()
                  .substring(0, 300);
              } else {
                descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
                if (descMatch) {
                  description = descMatch[1]
                    .replace(/<[^>]*>/g, '')
                    .replace(/&[^;]+;/g, ' ')
                    .trim()
                    .substring(0, 300);
                }
              }
              if (description.length === 300) description += '...';

              // Extract pub date
              const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
              const pubDate = pubDateMatch ? pubDateMatch[1] : '';

              // Extract category if available
              const categoryMatch = item.match(/<category[^>]*?>(.*?)<\/category>/);
              const jobCategory = categoryMatch ? categoryMatch[1] : '';

              // Parse company and location from title or description
              let company = 'Unknown Company';
              const location = 'Remote';

              // Common patterns to extract company from title
              const companyPatterns = [
                /at\s+([^:]+):/i,
                /\|\s*([^|]+)$/,
                /-\s*([^-]+)$/,
                /\(([^)]+)\)$/
              ];

              for (const pattern of companyPatterns) {
                const match = title.match(pattern);
                if (match) {
                  company = match[1].trim();
                  break;
                }
              }

              // Clean up title by removing company info
              title = title.replace(/\s*at\s+[^:]+:/i, '')
                          .replace(/\s*\|\s*[^|]+$/, '')
                          .replace(/\s*-\s*[^-]+$/, '')
                          .replace(/\s*\([^)]+\)$/, '')
                          .trim();

              const hash = generateJobHash(title, company);

              return {
                title,
                company,
                location,
                url,
                description,
                pubDate,
                provider: providerName,
                category: jobCategory,
                hash
              };
            });
          } catch (error) {
            console.error(`Error parsing RSS feed ${url}:`, error);
            return [];
          }
        };

        // Define RSS feed URLs
        const feedUrls = {
          weworkremotely: {
            all: 'https://weworkremotely.com/remote-jobs.rss',
            programming: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
            design: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
            marketing: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
            'customer-support': 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
            sales: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
            management: 'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss'
          },
          remotive: {
            all: 'https://remotive.com/feed'
          },
          himalayas: {
            all: 'https://himalayas.app/jobs/rss'
          }
        };

        // Fetch jobs from selected providers
        const fetchPromises = providers.map(async (provider) => {
          const urls = feedUrls[provider] as Record<string, string>;
          const feedUrl = urls[category] || urls.all;

          if (feedUrl) {
            const providerJobs = await parseRSSFeed(feedUrl, provider);
            return providerJobs;
          }
          return [];
        });

        const allResults = await Promise.all(fetchPromises);
        const allJobs = allResults.flat();

        // Filter by keywords if provided
        let filteredJobs = allJobs;
        if (keywords) {
          const keywordLower = keywords.toLowerCase();
          filteredJobs = allJobs.filter(job =>
            job.title.toLowerCase().includes(keywordLower) ||
            job.description.toLowerCase().includes(keywordLower) ||
            job.company.toLowerCase().includes(keywordLower)
          );
        }

        // Remove duplicates based on hash
        const uniqueJobs: JobEntry[] = [];
        const seenHashes = new Set();

        for (const job of filteredJobs) {
          if (!seenHashes.has(job.hash)) {
            seenHashes.add(job.hash);
            uniqueJobs.push(job);
          }
        }

        // Sort by most recent and limit results
        const sortedJobs = uniqueJobs
          .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
          .slice(0, limit);

        if (sortedJobs.length === 0) {
          const keywordText = keywords ? ` matching "${keywords}"` : '';
          const categoryText = category !== 'all' ? ` in ${category}` : '';
          return {
            content: [{
              type: 'text' as const,
              text: `No remote jobs found${keywordText}${categoryText} across the selected providers. Try different keywords or broader search terms.`
            }]
          };
        }

        // Format results
        const formattedJobs = sortedJobs.map((job) => {
          let jobInfo = `* **${job.title}**\n`;
          jobInfo += `  Company: ${job.company}\n`;
          jobInfo += `  Location: ${job.location}\n`;
          jobInfo += `  Provider: ${job.provider}\n`;

          if (job.category) {
            jobInfo += `  Category: ${job.category}\n`;
          }

          if (job.description) {
            jobInfo += `  Description: ${job.description}\n`;
          }

          jobInfo += `  URL: ${job.url}\n`;
          jobInfo += `  Posted: ${job.pubDate}\n`;

          return jobInfo;
        }).join('\n');

        const keywordText = keywords ? ` matching "${keywords}"` : '';
        const categoryText = category !== 'all' ? ` in ${category}` : '';
        const providerText = providers.join(', ');
        const duplicateCount = allJobs.length - uniqueJobs.length;
        const duplicateText = duplicateCount > 0 ? ` (${duplicateCount} duplicates removed)` : '';

        return {
          content: [{
            type: 'text' as const,
            text: `Found ${sortedJobs.length} unique remote job(s)${keywordText}${categoryText} from ${providerText}${duplicateText}:\n\n${formattedJobs}\n\nData aggregated from multiple remote job RSS feeds`
          }]
        };

      } catch (error) {
        console.error('Error in search_remote_jobs:', error);
        return {
          content: [{
            type: 'text' as const,
            text: `Error searching remote jobs: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease try again later.`
          }]
        };
      }
    }
  );
}
