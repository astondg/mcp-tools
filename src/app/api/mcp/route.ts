import { z } from 'zod';
import { createMcpHandler } from '@vercel/mcp-adapter';
import { TokenStorage } from '@/lib/redis';
import { prisma } from '@/lib/db';
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicles,
  createServiceRecord,
  getServiceHistory,
  updateServiceRecord,
  deleteServiceRecord,
  createPart,
  getParts,
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  deleteMaintenanceSchedule,
  getMaintenanceSchedules,
  getUpcomingMaintenance,
} from '@/lib/vehicle/queries';
import { SERVICE_TYPES } from '@/lib/vehicle/types';
import {
  upsertCategory,
  getCategories,
  deleteCategory,
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  importExpenses,
  addCategorizationRule,
  getCategorizationRules,
  deleteCategorizationRule,
  suggestCategory,
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
  getCategorizationSuggestions,
} from '@/lib/budget/queries';
import type { ExpenseGroupBy, IncomeGroupBy, ExpenseAnalyticsGroupBy, ExpenseSearchResponse } from '@/lib/budget/types';
import { BUDGET_PERIODS } from '@/lib/budget/types';

// Type definitions
interface FreelancerProject {
  id: number;
  title: string;
  description?: string;
  preview_description?: string;
  budget?: {
    minimum?: number;
    maximum?: number;
    currency?: string;
  };
  jobs?: Array<{ name: string }>;
  bid_stats?: { 
    bid_count: number;
    bid_avg?: number;
  };
  time_submitted?: number;
  location?: {
    city?: string;
    country?: {
      name?: string;
    };
  };
}

interface FreelancerBudget {
  minimum?: number;
  maximum?: number;
  currency?: string;
}

interface BidRequest {
  project_id: number;
  bidder_id: number;
  amount: number;
  period: number;
  milestone_percentage: number;
  description?: string;
  profile_id?: number;
}

interface BidResponse {
  id: number;
  bidder_id: number;
  project_id: number;
  amount: number;
  period: number;
  description: string;
  time_submitted: number;
  award_status?: string | null;
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

async function placeBidOnProject(
  token: string,
  bidRequest: BidRequest
): Promise<BidResponse> {
  const baseUrl = 'https://www.freelancer.com/api/projects/0.1/bids/';

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Freelancer-OAuth-V1': token,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bidRequest)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Freelancer bid API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.result;
}

async function getProjectDetails(
  token: string,
  projectId: number,
  options: {
    fullDescription?: boolean;
    jobDetails?: boolean;
    upgradeDetails?: boolean;
    attachmentDetails?: boolean;
    fileDetails?: boolean;
    qualificationDetails?: boolean;
    selectedBids?: boolean;
    hiremeDetails?: boolean;
    userDetails?: boolean;
    invitedFreelancerDetails?: boolean;
    recommendedFreelancerDetails?: boolean;
    hourlyDetails?: boolean;
    supportSessionDetails?: boolean;
    locationDetails?: boolean;
    ndaSignatureDetails?: boolean;
    projectCollaborationDetails?: boolean;
    trackDetails?: boolean;
    proximityDetails?: boolean;
    reviewAvailabilityDetails?: boolean;
    negotiatedDetails?: boolean;
    driveFileDetails?: boolean;
    ndaDetails?: boolean;
    localDetails?: boolean;
    userAvatar?: boolean;
    userCountryDetails?: boolean;
    userProfileDescription?: boolean;
    userDisplayInfo?: boolean;
    userJobs?: boolean;
    userBalanceDetails?: boolean;
    userQualificationDetails?: boolean;
    userMembershipDetails?: boolean;
    userFinancialDetails?: boolean;
    userLocationDetails?: boolean;
    userPortfolioDetails?: boolean;
    userPreferredDetails?: boolean;
    userBadgeDetails?: boolean;
    userStatus?: boolean;
    userReputation?: boolean;
    userEmployerReputation?: boolean;
    userReputationExtra?: boolean;
    userEmployerReputationExtra?: boolean;
    userCoverImage?: boolean;
    userPastCoverImages?: boolean;
    userRecommendations?: boolean;
    userResponsiveness?: boolean;
    corporateUsers?: boolean;
    marketingMobileNumber?: boolean;
    sanctionDetails?: boolean;
    limitedAccount?: boolean;
    equipmentGroupDetails?: boolean;
    limit?: number;
    offset?: number;
    compact?: boolean;
  } = {}
) {
  const baseUrl = `https://www.freelancer.com/api/projects/0.1/projects/${projectId}/`;
  const params = new URLSearchParams();

  // Add all the optional boolean parameters
  if (options.fullDescription) params.append('full_description', 'true');
  if (options.jobDetails) params.append('job_details', 'true');
  if (options.upgradeDetails) params.append('upgrade_details', 'true');
  if (options.attachmentDetails) params.append('attachment_details', 'true');
  if (options.fileDetails) params.append('file_details', 'true');
  if (options.qualificationDetails) params.append('qualification_details', 'true');
  if (options.selectedBids) params.append('selected_bids', 'true');
  if (options.hiremeDetails) params.append('hireme_details', 'true');
  if (options.userDetails) params.append('user_details', 'true');
  if (options.invitedFreelancerDetails) params.append('invited_freelancer_details', 'true');
  if (options.recommendedFreelancerDetails) params.append('recommended_freelancer_details', 'true');
  if (options.hourlyDetails) params.append('hourly_details', 'true');
  if (options.supportSessionDetails) params.append('support_session_details', 'true');
  if (options.locationDetails) params.append('location_details', 'true');
  if (options.ndaSignatureDetails) params.append('nda_signature_details', 'true');
  if (options.projectCollaborationDetails) params.append('project_collaboration_details', 'true');
  if (options.trackDetails) params.append('track_details', 'true');
  if (options.proximityDetails) params.append('proximity_details', 'true');
  if (options.reviewAvailabilityDetails) params.append('review_availability_details', 'true');
  if (options.negotiatedDetails) params.append('negotiated_details', 'true');
  if (options.driveFileDetails) params.append('drive_file_details', 'true');
  if (options.ndaDetails) params.append('nda_details', 'true');
  if (options.localDetails) params.append('local_details', 'true');
  if (options.userAvatar) params.append('user_avatar', 'true');
  if (options.userCountryDetails) params.append('user_country_details', 'true');
  if (options.userProfileDescription) params.append('user_profile_description', 'true');
  if (options.userDisplayInfo) params.append('user_display_info', 'true');
  if (options.userJobs) params.append('user_jobs', 'true');
  if (options.userBalanceDetails) params.append('user_balance_details', 'true');
  if (options.userQualificationDetails) params.append('user_qualification_details', 'true');
  if (options.userMembershipDetails) params.append('user_membership_details', 'true');
  if (options.userFinancialDetails) params.append('user_financial_details', 'true');
  if (options.userLocationDetails) params.append('user_location_details', 'true');
  if (options.userPortfolioDetails) params.append('user_portfolio_details', 'true');
  if (options.userPreferredDetails) params.append('user_preferred_details', 'true');
  if (options.userBadgeDetails) params.append('user_badge_details', 'true');
  if (options.userStatus) params.append('user_status', 'true');
  if (options.userReputation) params.append('user_reputation', 'true');
  if (options.userEmployerReputation) params.append('user_employer_reputation', 'true');
  if (options.userReputationExtra) params.append('user_reputation_extra', 'true');
  if (options.userEmployerReputationExtra) params.append('user_employer_reputation_extra', 'true');
  if (options.userCoverImage) params.append('user_cover_image', 'true');
  if (options.userPastCoverImages) params.append('user_past_cover_images', 'true');
  if (options.userRecommendations) params.append('user_recommendations', 'true');
  if (options.userResponsiveness) params.append('user_responsiveness', 'true');
  if (options.corporateUsers) params.append('corporate_users', 'true');
  if (options.marketingMobileNumber) params.append('marketing_mobile_number', 'true');
  if (options.sanctionDetails) params.append('sanction_details', 'true');
  if (options.limitedAccount) params.append('limited_account', 'true');
  if (options.equipmentGroupDetails) params.append('equipment_group_details', 'true');
  
  // Add numeric parameters
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());
  if (options.compact) params.append('compact', 'true');

  const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  
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
  return data.result;
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
    // Helper function to parse OzBargain RSS deals
    async function fetchOzBargainDeals(limit = 50) {
      const response = await fetch('https://www.ozbargain.com.au/deals/feed', {
        headers: {
          'User-Agent': 'MCP-Tools RSS Reader/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xmlText = await response.text();
      const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);

      if (!itemMatches) return [];

      return itemMatches.slice(0, limit).map((item) => {
        // Extract title
        let titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        let title = titleMatch ? titleMatch[1] : '';
        if (!title) {
          titleMatch = item.match(/<title>(.*?)<\/title>/);
          title = titleMatch ? titleMatch[1] : '';
        }

        // Extract link
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const link = linkMatch ? linkMatch[1] : '';

        // Extract description
        const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
        let description = '';
        let price = null;
        let store = null;

        if (descMatch) {
          const rawDesc = descMatch[1];

          // Try to extract price from description
          const priceMatch = rawDesc.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
          if (priceMatch) price = parseFloat(priceMatch[1]);

          // Try to extract store
          const storeMatch = rawDesc.match(/(?:at|from|@)\s+([A-Z][a-zA-Z\s&]+?)(?:\s*<|$)/);
          if (storeMatch) store = storeMatch[1].trim();

          // Clean description
          description = rawDesc
            .replace(/<[^>]*>/g, '')
            .replace(/&[^;]+;/g, ' ')
            .trim()
            .substring(0, 300);
          if (description.length === 300) description += '...';
        }

        // Extract thumbnail
        const thumbnailMatch = item.match(/<media:thumbnail url="([^"]*?)"/);
        const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;

        // Extract categories
        const categoryMatches = item.match(/<category[^>]*?>(.*?)<\/category>/g);
        const categories = categoryMatches ?
          categoryMatches.map(cat => cat.replace(/<[^>]*>/g, '').trim()) : [];

        // Extract publish date
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();

        return {
          title,
          link,
          description,
          price,
          store,
          thumbnail,
          categories,
          pubDate,
          rawItem: item // Keep for advanced parsing
        };
      });
    }

    // Enhanced OzBargain deals tool
    server.tool(
      'ozbargain_get_deals',
      'Fetch latest deals from OzBargain with enhanced parsing including price and store info',
      {
        limit: z.number().int().min(1).max(50).default(10).describe('Number of deals to return (1-50)'),
        minVotes: z.number().int().min(0).optional().describe('Minimum votes (extracted from comments count as proxy)'),
      },
      async (params) => {
        try {
          const deals = await fetchOzBargainDeals(params.limit * 2); // Fetch extra for filtering

          // Filter and format
          const filtered = deals.slice(0, params.limit);

          const formatted = filtered.map(deal => ({
            title: deal.title,
            link: deal.link,
            description: deal.description,
            price: deal.price ? `$${deal.price}` : 'N/A',
            store: deal.store || 'Unknown',
            categories: deal.categories,
            publishedAt: deal.pubDate.toISOString().split('T')[0],
            thumbnail: deal.thumbnail
          }));

          return {
            content: [{
              type: 'text',
              text: `🔥 Found ${formatted.length} deals from OzBargain:\n\n${JSON.stringify(formatted, null, 2)}`
            }]
          };
        } catch (error) {
          console.error('Error fetching OzBargain deals:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          };
        }
      }
    );

    // Search OzBargain deals
    server.tool(
      'ozbargain_search_deals',
      'Search OzBargain deals with keyword and filter options',
      {
        keywords: z.string().min(1).describe('Search keywords (checks title and description)'),
        maxPrice: z.number().positive().optional().describe('Maximum price filter'),
        category: z.string().optional().describe('Filter by category name'),
        limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
      },
      async (params) => {
        try {
          const deals = await fetchOzBargainDeals(100); // Fetch more for searching

          const keywords = params.keywords.toLowerCase();
          const filtered = deals.filter(deal => {
            // Keyword match
            const matchesKeyword =
              deal.title.toLowerCase().includes(keywords) ||
              deal.description.toLowerCase().includes(keywords) ||
              (deal.store && deal.store.toLowerCase().includes(keywords));

            if (!matchesKeyword) return false;

            // Price filter
            if (params.maxPrice && deal.price && deal.price > params.maxPrice) {
              return false;
            }

            // Category filter
            if (params.category) {
              const categoryMatch = deal.categories.some(cat =>
                cat.toLowerCase().includes(params.category!.toLowerCase())
              );
              if (!categoryMatch) return false;
            }

            return true;
          }).slice(0, params.limit);

          if (filtered.length === 0) {
            return {
              content: [{
                type: 'text',
                text: `🔍 No deals found matching "${params.keywords}"${params.maxPrice ? ` under $${params.maxPrice}` : ''}`
              }]
            };
          }

          const formatted = filtered.map(deal => ({
            title: deal.title,
            link: deal.link,
            price: deal.price ? `$${deal.price}` : 'N/A',
            store: deal.store || 'Unknown',
            categories: deal.categories,
            publishedAt: deal.pubDate.toISOString().split('T')[0],
          }));

          return {
            content: [{
              type: 'text',
              text: `🔍 Found ${formatted.length} matching deals:\n\n${JSON.stringify(formatted, null, 2)}`
            }]
          };
        } catch (error) {
          console.error('Error searching OzBargain:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          };
        }
      }
    );

    // Smart deal matcher using purchase history and wishlist
    server.tool(
      'shopping_find_matching_deals',
      'Intelligently find OzBargain deals that match your purchase history, wishlist, and preferences',
      {
        checkWishlist: z.boolean().default(true).describe('Match against wishlist items'),
        checkPurchaseHistory: z.boolean().default(true).describe('Match against purchase patterns'),
        useProfile: z.boolean().default(true).describe('Apply profile preferences (min votes, preferred brands)'),
        maxResults: z.number().int().min(1).max(20).default(10).describe('Maximum deals to return'),
      },
      async (params) => {
        try {
          // Fetch deals
          const deals = await fetchOzBargainDeals(100);

          // Get wishlist
          const wishlist = params.checkWishlist ? await prisma.wishlistItem.findMany({
            where: { isActive: true },
            include: { category: true }
          }) : [];

          // Get purchase history categories
          const purchaseCategories = params.checkPurchaseHistory ? await prisma.purchaseHistory.findMany({
            select: {
              category: { select: { name: true } },
              brand: true,
              merchant: true
            },
            take: 200
          }) : [];

          // Get profile
          const profile = params.useProfile ? await prisma.shoppingProfile.findUnique({
            where: { profileName: 'default' }
          }) : null;

          // Build matching criteria
          const wishlistKeywords = wishlist.map(w => w.itemName.toLowerCase());
          const wishlistBrands = wishlist.map(w => w.brand?.toLowerCase()).filter(Boolean);
          const categoryNames = [...new Set(purchaseCategories.map(p => p.category.name.toLowerCase()))];
          const brandNames = [...new Set(purchaseCategories.map(p => p.brand?.toLowerCase()).filter(Boolean) as string[])];
          const merchantNames = [...new Set(purchaseCategories.map(p => p.merchant?.toLowerCase()).filter(Boolean) as string[])];

          // Preferred/avoided from profile
          const preferredMerchants: string[] = profile?.preferredMerchants ? JSON.parse(profile.preferredMerchants).map((m: string) => m.toLowerCase()) : [];
          const avoidedMerchants: string[] = profile?.avoidedMerchants ? JSON.parse(profile.avoidedMerchants).map((m: string) => m.toLowerCase()) : [];
          const preferredBrands: string[] = profile?.preferredBrands ? JSON.parse(profile.preferredBrands).map((b: string) => b.toLowerCase()) : [];

          // Score and filter deals
          const scoredDeals = deals.map(deal => {
            let score = 0;
            const reasons: string[] = [];
            const dealTitle = deal.title.toLowerCase();
            const dealDesc = deal.description.toLowerCase();
            const dealStore = deal.store?.toLowerCase() || '';

            // Check wishlist matches (highest priority)
            wishlistKeywords.forEach(keyword => {
              if (dealTitle.includes(keyword) || dealDesc.includes(keyword)) {
                score += 100;
                reasons.push(`Matches wishlist: "${keyword}"`);
              }
            });

            wishlistBrands.forEach(brand => {
              if (brand && (dealTitle.includes(brand) || dealDesc.includes(brand))) {
                score += 50;
                reasons.push(`Matches wishlist brand: ${brand}`);
              }
            });

            // Check purchase history patterns
            categoryNames.forEach(cat => {
              deal.categories.forEach(dealCat => {
                if (dealCat.toLowerCase().includes(cat)) {
                  score += 20;
                  reasons.push(`Matches purchase category: ${cat}`);
                }
              });
            });

            brandNames.forEach(brand => {
              if (dealTitle.includes(brand) || dealDesc.includes(brand)) {
                score += 30;
                reasons.push(`Matches frequently purchased brand: ${brand}`);
              }
            });

            merchantNames.forEach(merchant => {
              if (dealStore.includes(merchant)) {
                score += 10;
                reasons.push(`Matches frequent merchant: ${merchant}`);
              }
            });

            // Profile preferences
            preferredMerchants.forEach(merchant => {
              if (dealStore.includes(merchant)) {
                score += 25;
                reasons.push(`Preferred merchant: ${merchant}`);
              }
            });

            preferredBrands.forEach(brand => {
              if (dealTitle.includes(brand) || dealDesc.includes(brand)) {
                score += 25;
                reasons.push(`Preferred brand: ${brand}`);
              }
            });

            // Penalties
            avoidedMerchants.forEach(merchant => {
              if (dealStore.includes(merchant)) {
                score -= 100;
                reasons.push(`Avoided merchant: ${merchant}`);
              }
            });

            return {
              deal,
              score,
              reasons: [...new Set(reasons)] // Remove duplicates
            };
          });

          // Filter and sort
          const matched = scoredDeals
            .filter(sd => sd.score > 0) // Only show positive matches
            .sort((a, b) => b.score - a.score)
            .slice(0, params.maxResults);

          if (matched.length === 0) {
            return {
              content: [{
                type: 'text',
                text: `🤷 No deals found matching your profile.\n\n` +
                      `Tip: Add items to your wishlist or build up your purchase history for better matches!`
              }]
            };
          }

          const formatted = matched.map(m => ({
            score: m.score,
            title: m.deal.title,
            link: m.deal.link,
            price: m.deal.price ? `$${m.deal.price}` : 'N/A',
            store: m.deal.store || 'Unknown',
            matchReasons: m.reasons,
            publishedAt: m.deal.pubDate.toISOString().split('T')[0]
          }));

          return {
            content: [{
              type: 'text',
              text: `🎯 Found ${formatted.length} personalized deals for you:\n\n${JSON.stringify(formatted, null, 2)}\n\n` +
                    `💡 Deals are ranked by relevance to your wishlist, purchase history, and preferences.`
            }]
          };
        } catch (error) {
          console.error('Error finding matching deals:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          };
        }
      }
    );

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
            const skills = p.jobs?.map((job: { name: string }) => job.name).slice(0, 5).join(', ') || 'Not specified';
            const timePosted = formatTimeAgo(p.time_submitted);
            
            // Get description - prefer full description, fall back to preview
            const description = p.description || p.preview_description || '';
            const truncatedDescription = description.length > 150 
              ? description.substring(0, 150) + '...' 
              : description;
            
            // Get location info
            let location = 'Not specified';
            if (p.location) {
              const city = p.location.city || '';
              const country = p.location.country?.name || '';
              if (city && country) {
                location = `${city}, ${country}`;
              } else if (city) {
                location = city;
              } else if (country) {
                location = country;
              }
            }
            
            let projectInfo = `• **${p.title}** (ID: ${p.id})\n`;
            projectInfo += `  Budget: ${budget}\n`;
            projectInfo += `  Skills: ${skills}\n`;
            projectInfo += `  Location: ${location}\n`;
            projectInfo += `  Bids: ${p.bid_stats?.bid_count || 0}`;
            if (p.bid_stats?.bid_avg) {
              projectInfo += ` (avg: $${p.bid_stats.bid_avg})`;
            }
            projectInfo += `\n  Posted: ${timePosted}`;
            
            if (truncatedDescription) {
              projectInfo += `\n  Description: ${truncatedDescription}`;
            }
            
            return projectInfo;
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

    // Freelancer project bidding tool
    server.tool(
      'place_freelancer_bid',
      'Place a bid on a freelancer project',
      {
        projectId: z.number().int().min(1).describe('ID of the project to bid on'),
        bidderId: z.number().int().min(1).describe('ID of the bidder (your user ID)'),
        amount: z.number().min(0.01).describe('Bid amount in project currency'),
        period: z.number().int().min(1).describe('Number of days to complete the project'),
        milestonePercentage: z.number().min(0).max(100).default(100).describe('Percentage of milestone payment (0-100)'),
        description: z.string().min(10).optional().describe('Bid proposal description'),
        profileId: z.number().int().optional().describe('Profile ID to use for bidding')
      },
      async ({ projectId, bidderId, amount, period, milestonePercentage, description, profileId }) => {
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

          // Prepare bid request
          const bidRequest: BidRequest = {
            project_id: projectId,
            bidder_id: bidderId,
            amount: amount,
            period: period,
            milestone_percentage: milestonePercentage,
            description: description,
            profile_id: profileId
          };

          // Place the bid
          const bidResult = await placeBidOnProject(token, bidRequest);

          const submittedTime = new Date(bidResult.time_submitted * 1000).toLocaleString();

          return {
            content: [{
              type: 'text',
              text: `✅ Bid placed successfully!\n\n` +
                    `• Bid ID: ${bidResult.id}\n` +
                    `• Project ID: ${bidResult.project_id}\n` +
                    `• Amount: $${bidResult.amount}\n` +
                    `• Period: ${bidResult.period} days\n` +
                    `• Description: ${bidResult.description}\n` +
                    `• Submitted: ${submittedTime}\n` +
                    `• Status: ${bidResult.award_status || 'Pending'}\n\n` +
                    `🔗 Bid submitted via Freelancer.com API`
            }]
          };
          
        } catch (error) {
          console.error('Error in place_freelancer_bid:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error placing bid: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease check your parameters and try again.`
            }]
          };
        }
      },
    );

    // Freelancer project details tool
    server.tool(
      'get_freelancer_project_details',
      'Get detailed information about a specific freelancer project by ID',
      {
        projectId: z.number().int().min(1).describe('ID of the project to get details for'),
        fullDescription: z.boolean().optional().describe('Include full project description'),
        jobDetails: z.boolean().optional().describe('Include job/skills information'),
        upgradeDetails: z.boolean().optional().describe('Include upgrade information'),
        attachmentDetails: z.boolean().optional().describe('Include attachment details'),
        fileDetails: z.boolean().optional().describe('Include files shared between employer and freelancer'),
        qualificationDetails: z.boolean().optional().describe('Include qualification/exam requirements'),
        selectedBids: z.boolean().optional().describe('Include awarded or pending bids'),
        hiremeDetails: z.boolean().optional().describe('Include hire-me offer information'),
        userDetails: z.boolean().optional().describe('Include basic user information'),
        invitedFreelancerDetails: z.boolean().optional().describe('Include invited freelancer details'),
        recommendedFreelancerDetails: z.boolean().optional().describe('Include recommended freelancer details'),
        hourlyDetails: z.boolean().optional().describe('Include hourly contract details'),
        supportSessionDetails: z.boolean().optional().describe('Include support session details'),
        locationDetails: z.boolean().optional().describe('Include project location information'),
        ndaSignatureDetails: z.boolean().optional().describe('Include NDA signature details'),
        projectCollaborationDetails: z.boolean().optional().describe('Include project collaborator details'),
        trackDetails: z.boolean().optional().describe('Include track ID details'),
        proximityDetails: z.boolean().optional().describe('Include proximity information'),
        reviewAvailabilityDetails: z.boolean().optional().describe('Include review availability details'),
        negotiatedDetails: z.boolean().optional().describe('Include negotiated offer details'),
        driveFileDetails: z.boolean().optional().describe('Include drive file information'),
        ndaDetails: z.boolean().optional().describe('Include NDA details and hidden descriptions'),
        localDetails: z.boolean().optional().describe('Include local project details'),
        userAvatar: z.boolean().optional().describe('Include user avatar information'),
        userCountryDetails: z.boolean().optional().describe('Include user country information'),
        userProfileDescription: z.boolean().optional().describe('Include user profile descriptions'),
        userDisplayInfo: z.boolean().optional().describe('Include user display information'),
        userJobs: z.boolean().optional().describe('Include user job information'),
        userBalanceDetails: z.boolean().optional().describe('Include user balance details'),
        userQualificationDetails: z.boolean().optional().describe('Include user qualification details'),
        userMembershipDetails: z.boolean().optional().describe('Include user membership information'),
        userFinancialDetails: z.boolean().optional().describe('Include user financial information'),
        userLocationDetails: z.boolean().optional().describe('Include user location details'),
        userPortfolioDetails: z.boolean().optional().describe('Include user portfolio information'),
        userPreferredDetails: z.boolean().optional().describe('Include user preferred information'),
        userBadgeDetails: z.boolean().optional().describe('Include user badge information'),
        userStatus: z.boolean().optional().describe('Include additional user status information'),
        userReputation: z.boolean().optional().describe('Include freelancer reputation'),
        userEmployerReputation: z.boolean().optional().describe('Include employer reputation'),
        userReputationExtra: z.boolean().optional().describe('Include full freelancer reputation'),
        userEmployerReputationExtra: z.boolean().optional().describe('Include full employer reputation'),
        userCoverImage: z.boolean().optional().describe('Include user profile picture'),
        userPastCoverImages: z.boolean().optional().describe('Include previous profile pictures'),
        userRecommendations: z.boolean().optional().describe('Include user recommendations count'),
        userResponsiveness: z.boolean().optional().describe('Include user responsiveness scores'),
        corporateUsers: z.boolean().optional().describe('Include corporate account information'),
        marketingMobileNumber: z.boolean().optional().describe('Include marketing mobile number'),
        sanctionDetails: z.boolean().optional().describe('Include sanction details'),
        limitedAccount: z.boolean().optional().describe('Include limited account status'),
        equipmentGroupDetails: z.boolean().optional().describe('Include equipment group details'),
        limit: z.number().int().min(1).optional().describe('Maximum number of results to return'),
        offset: z.number().int().min(0).optional().describe('Number of results to skip for pagination'),
        compact: z.boolean().optional().describe('Strip null and empty values from response')
      },
      async ({ 
        projectId, 
        fullDescription, 
        jobDetails, 
        upgradeDetails, 
        attachmentDetails, 
        fileDetails, 
        qualificationDetails, 
        selectedBids, 
        hiremeDetails, 
        userDetails, 
        invitedFreelancerDetails, 
        recommendedFreelancerDetails, 
        hourlyDetails, 
        supportSessionDetails, 
        locationDetails, 
        ndaSignatureDetails, 
        projectCollaborationDetails, 
        trackDetails, 
        proximityDetails, 
        reviewAvailabilityDetails, 
        negotiatedDetails, 
        driveFileDetails, 
        ndaDetails, 
        localDetails, 
        userAvatar, 
        userCountryDetails, 
        userProfileDescription, 
        userDisplayInfo, 
        userJobs, 
        userBalanceDetails, 
        userQualificationDetails, 
        userMembershipDetails, 
        userFinancialDetails, 
        userLocationDetails, 
        userPortfolioDetails, 
        userPreferredDetails, 
        userBadgeDetails, 
        userStatus, 
        userReputation, 
        userEmployerReputation, 
        userReputationExtra, 
        userEmployerReputationExtra, 
        userCoverImage, 
        userPastCoverImages, 
        userRecommendations, 
        userResponsiveness, 
        corporateUsers, 
        marketingMobileNumber, 
        sanctionDetails, 
        limitedAccount, 
        equipmentGroupDetails, 
        limit, 
        offset, 
        compact 
      }) => {
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

          // Get project details
          const projectDetails = await getProjectDetails(token, projectId, {
            fullDescription,
            jobDetails,
            upgradeDetails,
            attachmentDetails,
            fileDetails,
            qualificationDetails,
            selectedBids,
            hiremeDetails,
            userDetails,
            invitedFreelancerDetails,
            recommendedFreelancerDetails,
            hourlyDetails,
            supportSessionDetails,
            locationDetails,
            ndaSignatureDetails,
            projectCollaborationDetails,
            trackDetails,
            proximityDetails,
            reviewAvailabilityDetails,
            negotiatedDetails,
            driveFileDetails,
            ndaDetails,
            localDetails,
            userAvatar,
            userCountryDetails,
            userProfileDescription,
            userDisplayInfo,
            userJobs,
            userBalanceDetails,
            userQualificationDetails,
            userMembershipDetails,
            userFinancialDetails,
            userLocationDetails,
            userPortfolioDetails,
            userPreferredDetails,
            userBadgeDetails,
            userStatus,
            userReputation,
            userEmployerReputation,
            userReputationExtra,
            userEmployerReputationExtra,
            userCoverImage,
            userPastCoverImages,
            userRecommendations,
            userResponsiveness,
            corporateUsers,
            marketingMobileNumber,
            sanctionDetails,
            limitedAccount,
            equipmentGroupDetails,
            limit,
            offset,
            compact
          });

          // Format the response based on available data
          let response = `📋 Project Details for ID: ${projectDetails.id}\n\n`;
          response += `• **Title:** ${projectDetails.title}\n`;
          response += `• **Status:** ${projectDetails.status}\n`;
          response += `• **Type:** ${projectDetails.type}\n`;
          
          if (projectDetails.budget) {
            const budget = formatBudget(projectDetails.budget);
            response += `• **Budget:** ${budget}\n`;
          }
          
          if (projectDetails.bid_stats) {
            response += `• **Bids:** ${projectDetails.bid_stats.bid_count || 0}`;
            if (projectDetails.bid_stats.bid_avg) {
              response += ` (avg: $${projectDetails.bid_stats.bid_avg})`;
            }
            response += '\n';
          }
          
          if (projectDetails.time_submitted) {
            const timePosted = formatTimeAgo(projectDetails.time_submitted);
            response += `• **Posted:** ${timePosted}\n`;
          }
          
          if (projectDetails.bidperiod) {
            response += `• **Bid Period:** ${projectDetails.bidperiod} days\n`;
          }

          if (projectDetails.description || projectDetails.preview_description) {
            response += `\n**Description:**\n${projectDetails.description || projectDetails.preview_description}\n`;
          }

          if (projectDetails.jobs && projectDetails.jobs.length > 0) {
            const skills = projectDetails.jobs.map((job: { name: string }) => job.name).join(', ');
            response += `\n**Skills Required:** ${skills}\n`;
          }

          if (projectDetails.location) {
            response += `\n**Location:** ${projectDetails.location.city || 'Not specified'}`;
            if (projectDetails.location.country?.name) {
              response += `, ${projectDetails.location.country.name}`;
            }
            response += '\n';
          }

          if (projectDetails.upgrades) {
            const upgrades = Object.entries(projectDetails.upgrades)
              .filter(([, value]) => value === true)
              .map(([key]) => key.replace(/_/g, ' ').toUpperCase());
            if (upgrades.length > 0) {
              response += `\n**Upgrades:** ${upgrades.join(', ')}\n`;
            }
          }

          if (projectDetails.seo_url) {
            response += `\n🔗 **Project URL:** https://www.freelancer.com/projects/${projectDetails.seo_url}\n`;
          }

          response += `\n📊 Data retrieved via Freelancer.com API`;

          return {
            content: [{
              type: 'text',
              text: response
            }]
          };
          
        } catch (error) {
          console.error('Error in get_freelancer_project_details:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error getting project details: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease check the project ID and try again.`
            }]
          };
        }
      },
    );

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
          const uniqueJobs = [];
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
                type: 'text',
                text: `No remote jobs found${keywordText}${categoryText} across the selected providers. Try different keywords or broader search terms.`
              }]
            };
          }

          // Format results
          const formattedJobs = sortedJobs.map((job) => {
            let jobInfo = `• **${job.title}**\n`;
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
              type: 'text',
              text: `✅ Found ${sortedJobs.length} unique remote job(s)${keywordText}${categoryText} from ${providerText}${duplicateText}:\n\n${formattedJobs}\n\n🔗 Data aggregated from multiple remote job RSS feeds`
            }]
          };
          
        } catch (error) {
          console.error('Error in search_remote_jobs:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error searching remote jobs: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease try again later.`
            }]
          };
        }
      }
    );

    // ==========================================
    // Vehicle Maintenance Tracking Tools
    // ==========================================

    // Vehicle management tool (add/update/delete)
    server.tool(
      'vehicle_manage',
      'Add, update, or delete a vehicle for maintenance tracking',
      {
        action: z.enum(['add', 'update', 'delete']).describe('Action to perform'),
        // For add
        name: z.string().min(1).max(100).optional().describe('Display name (e.g., "Family SUV")'),
        make: z.string().min(1).max(50).optional().describe('Manufacturer (e.g., "Toyota")'),
        model: z.string().min(1).max(50).optional().describe('Model name (e.g., "RAV4")'),
        year: z.number().int().min(1900).max(2100).optional().describe('Model year'),
        vin: z.string().max(17).optional().describe('Vehicle Identification Number'),
        licensePlate: z.string().max(20).optional().describe('Registration plate'),
        currentOdometer: z.number().int().min(0).optional().describe('Current odometer reading in km'),
        notes: z.string().optional().describe('Additional notes'),
        // For update/delete
        vehicleId: z.string().uuid().optional().describe('Vehicle ID (required for update/delete)'),
        // For delete
        confirm: z.boolean().optional().describe('Must be true to confirm deletion'),
      },
      async (params) => {
        try {
          const { action, vehicleId, confirm, name, make, model, ...rest } = params;

          if (action === 'add') {
            if (!name || !make || !model) {
              return {
                content: [{ type: 'text', text: '❌ Name, make, and model are required to add a vehicle.' }]
              };
            }
            const vehicle = await createVehicle({ name, make, model, ...rest });
            return {
              content: [{
                type: 'text',
                text: `✅ Vehicle added successfully!\n\n` +
                      `• ID: ${vehicle.id}\n` +
                      `• Name: ${vehicle.name}\n` +
                      `• Vehicle: ${vehicle.year || ''} ${vehicle.make} ${vehicle.model}\n` +
                      `• Odometer: ${vehicle.currentOdometer.toLocaleString()} km\n` +
                      (vehicle.vin ? `• VIN: ${vehicle.vin}\n` : '') +
                      (vehicle.licensePlate ? `• Plate: ${vehicle.licensePlate}\n` : '')
              }]
            };
          }

          if (action === 'update') {
            if (!vehicleId) {
              return {
                content: [{ type: 'text', text: '❌ vehicleId is required for update action.' }]
              };
            }
            const updateData: Record<string, unknown> = {};
            if (name !== undefined) updateData.name = name;
            if (make !== undefined) updateData.make = make;
            if (model !== undefined) updateData.model = model;
            Object.entries(rest).forEach(([k, v]) => {
              if (v !== undefined) updateData[k] = v;
            });

            const vehicle = await updateVehicle(vehicleId, updateData);
            return {
              content: [{
                type: 'text',
                text: `✅ Vehicle updated!\n\n` +
                      `• Name: ${vehicle.name}\n` +
                      `• Vehicle: ${vehicle.year || ''} ${vehicle.make} ${vehicle.model}\n` +
                      `• Odometer: ${vehicle.currentOdometer.toLocaleString()} km`
              }]
            };
          }

          if (action === 'delete') {
            if (!vehicleId) {
              return {
                content: [{ type: 'text', text: '❌ vehicleId is required for delete action.' }]
              };
            }
            if (!confirm) {
              return {
                content: [{ type: 'text', text: '⚠️ Set confirm: true to delete this vehicle and all its records.' }]
              };
            }
            await deleteVehicle(vehicleId);
            return {
              content: [{ type: 'text', text: `✅ Vehicle and all associated records deleted.` }]
            };
          }

          return {
            content: [{ type: 'text', text: '❌ Invalid action. Use add, update, or delete.' }]
          };
        } catch (error) {
          console.error('Error in vehicle_manage:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // List all vehicles
    server.tool(
      'vehicle_list',
      'List all tracked vehicles with their current odometer readings',
      {},
      async () => {
        try {
          const vehicles = await getVehicles();

          if (vehicles.length === 0) {
            return {
              content: [{ type: 'text', text: 'No vehicles found. Use vehicle_manage with action: "add" to add one.' }]
            };
          }

          const vehicleList = vehicles.map(v =>
            `• **${v.name}** (ID: ${v.id})\n` +
            `  ${v.year || ''} ${v.make} ${v.model}\n` +
            `  Odometer: ${v.currentOdometer.toLocaleString()} km` +
            (v.licensePlate ? `\n  Plate: ${v.licensePlate}` : '')
          ).join('\n\n');

          return {
            content: [{ type: 'text', text: `🚗 Your Vehicles (${vehicles.length}):\n\n${vehicleList}` }]
          };
        } catch (error) {
          console.error('Error in vehicle_list:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Add service record
    server.tool(
      'vehicle_add_service',
      'Log a service performed on a vehicle, optionally including parts used',
      {
        vehicleId: z.string().uuid().describe('Vehicle ID'),
        serviceDate: z.string().describe('Service date (YYYY-MM-DD)'),
        serviceType: z.string().describe(`Service type (e.g., ${SERVICE_TYPES.slice(0, 5).join(', ')})`),
        odometer: z.number().int().min(0).optional().describe('Odometer reading at service (km)'),
        cost: z.number().min(0).optional().describe('Amount actually paid for service'),
        serviceTotalValue: z.coerce.number().min(0).optional().describe('Total value of service before any discounts or service plan coverage'),
        provider: z.string().max(100).optional().describe('Service provider name'),
        notes: z.string().optional().describe('Service notes'),
        parts: z.array(z.object({
          partId: z.string().uuid().optional().describe('Existing part ID'),
          name: z.string().optional().describe('Part name (creates new part)'),
          manufacturer: z.string().optional().describe('Part manufacturer'),
          partNumber: z.string().optional().describe('Part number'),
          quantity: z.number().int().min(1).optional().describe('Quantity used'),
          costPerUnit: z.number().min(0).optional().describe('Cost per unit'),
        })).optional().describe('Parts used in this service'),
        updateSchedule: z.boolean().optional().describe('Auto-update matching maintenance schedule (default: true)'),
      },
      async (params) => {
        try {
          const serviceDate = new Date(params.serviceDate);
          if (isNaN(serviceDate.getTime())) {
            return {
              content: [{ type: 'text', text: '❌ Invalid date format. Use YYYY-MM-DD.' }]
            };
          }

          const record = await createServiceRecord({
            vehicleId: params.vehicleId,
            serviceDate,
            serviceType: params.serviceType,
            odometer: params.odometer,
            cost: params.cost,
            serviceTotalValue: params.serviceTotalValue,
            provider: params.provider,
            notes: params.notes,
            parts: params.parts,
            updateSchedule: params.updateSchedule,
          });

          let response = `✅ Service recorded!\n\n` +
            `• Vehicle: ${record.vehicleName}\n` +
            `• Date: ${record.serviceDate.toISOString().split('T')[0]}\n` +
            `• Type: ${record.serviceType}\n` +
            (record.odometer ? `• Odometer: ${record.odometer.toLocaleString()} km\n` : '') +
            (record.cost !== null ? `• Cost paid: $${record.cost.toFixed(2)}\n` : '') +
            (record.serviceTotalValue !== null ? `• Service value: $${record.serviceTotalValue.toFixed(2)}\n` : '') +
            (record.serviceTotalValue !== null && record.cost !== null && record.serviceTotalValue > record.cost
              ? `• Savings: $${(record.serviceTotalValue - record.cost).toFixed(2)}\n` : '') +
            (record.provider ? `• Provider: ${record.provider}\n` : '');

          if (record.parts && record.parts.length > 0) {
            response += `\n📦 Parts Used:\n`;
            record.parts.forEach(p => {
              response += `  • ${p.quantity}x ${p.partName}`;
              if (p.partNumber) response += ` (${p.partNumber})`;
              if (p.costPerUnit) response += ` - $${p.costPerUnit.toFixed(2)} each`;
              response += '\n';
            });
          }

          return { content: [{ type: 'text', text: response }] };
        } catch (error) {
          console.error('Error in vehicle_add_service:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Get service history
    server.tool(
      'vehicle_get_services',
      'Get service history for vehicles, with optional filters and text search. Use searchTerm to find services by provider, notes, or service type. Use providerSearch to find services at a specific shop (e.g., "costco", "repco").',
      {
        vehicleId: z.string().uuid().optional().describe('Filter by vehicle ID'),
        serviceType: z.string().optional().describe('Filter by service type'),
        startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
        includeParts: z.boolean().optional().describe('Include parts details (default: true)'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
        // New search parameters
        searchTerm: z.string().optional().describe('Search in provider, notes, and service type (case-insensitive)'),
        providerSearch: z.string().optional().describe('Search specifically for services at a provider/shop (case-insensitive)'),
        notesSearch: z.string().optional().describe('Search specifically in service notes (case-insensitive)'),
        partNameSearch: z.string().optional().describe('Search for services that used a specific part (searches part name, number, manufacturer)'),
      },
      async (params) => {
        try {
          const records = await getServiceHistory({
            vehicleId: params.vehicleId,
            serviceType: params.serviceType,
            startDate: params.startDate ? new Date(params.startDate) : undefined,
            endDate: params.endDate ? new Date(params.endDate) : undefined,
            includeParts: params.includeParts,
            limit: params.limit,
            searchTerm: params.searchTerm,
            providerSearch: params.providerSearch,
            notesSearch: params.notesSearch,
            partNameSearch: params.partNameSearch,
          });

          if (records.length === 0) {
            return {
              content: [{ type: 'text', text: 'No service records found matching your criteria.' }]
            };
          }

          const recordList = records.map(r => {
            let entry = `• **${r.serviceType}** on ${r.serviceDate.toISOString().split('T')[0]}\n` +
              `  ID: ${r.id}\n` +
              `  Vehicle: ${r.vehicleName}\n` +
              (r.odometer ? `  Odometer: ${r.odometer.toLocaleString()} km\n` : '') +
              (r.cost !== null ? `  Cost paid: $${r.cost.toFixed(2)}\n` : '') +
              (r.serviceTotalValue !== null ? `  Service value: $${r.serviceTotalValue.toFixed(2)}\n` : '') +
              (r.serviceTotalValue !== null && r.cost !== null && r.serviceTotalValue > r.cost
                ? `  Savings: $${(r.serviceTotalValue - r.cost).toFixed(2)}\n` : '') +
              (r.provider ? `  Provider: ${r.provider}\n` : '');

            if (r.parts && r.parts.length > 0) {
              entry += `  Parts: ${r.parts.map(p => p.partName).join(', ')}\n`;
            }
            return entry;
          }).join('\n');

          return {
            content: [{ type: 'text', text: `📋 Service History (${records.length} records):\n\n${recordList}` }]
          };
        } catch (error) {
          console.error('Error in vehicle_get_services:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Manage service record (update/delete)
    server.tool(
      'vehicle_manage_service',
      'Update or delete a service record',
      {
        action: z.enum(['update', 'delete']).describe('Action to perform'),
        serviceId: z.string().uuid().describe('Service record ID'),
        serviceDate: z.string().optional().describe('New service date (YYYY-MM-DD)'),
        serviceType: z.string().optional().describe('New service type'),
        odometer: z.number().int().min(0).optional().describe('New odometer reading'),
        cost: z.number().min(0).optional().describe('New amount paid'),
        serviceTotalValue: z.coerce.number().min(0).optional().describe('New service total value'),
        provider: z.string().optional().describe('New provider'),
        notes: z.string().optional().describe('New notes'),
      },
      async (params) => {
        try {
          if (params.action === 'delete') {
            await deleteServiceRecord(params.serviceId);
            return {
              content: [{ type: 'text', text: '✅ Service record deleted.' }]
            };
          }

          const updateData: Record<string, unknown> = {};
          if (params.serviceDate) updateData.serviceDate = new Date(params.serviceDate);
          if (params.serviceType) updateData.serviceType = params.serviceType;
          if (params.odometer !== undefined) updateData.odometer = params.odometer;
          if (params.cost !== undefined) updateData.cost = params.cost;
          if (params.serviceTotalValue !== undefined) updateData.serviceTotalValue = params.serviceTotalValue;
          if (params.provider !== undefined) updateData.provider = params.provider;
          if (params.notes !== undefined) updateData.notes = params.notes;

          const record = await updateServiceRecord(params.serviceId, updateData);
          return {
            content: [{
              type: 'text',
              text: `✅ Service record updated!\n\n` +
                    `• Type: ${record.serviceType}\n` +
                    `• Date: ${record.serviceDate.toISOString().split('T')[0]}\n` +
                    (record.cost ? `• Cost: $${record.cost.toFixed(2)}` : '')
            }]
          };
        } catch (error) {
          console.error('Error in vehicle_manage_service:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Add a part
    server.tool(
      'vehicle_add_part',
      'Register a part in the database for reuse across services',
      {
        name: z.string().min(1).max(100).describe('Part name (e.g., "Spark Plug")'),
        manufacturer: z.string().max(50).optional().describe('Brand (e.g., "NGK")'),
        model: z.string().max(100).optional().describe('Model name'),
        partNumber: z.string().max(50).optional().describe('Part number (e.g., "94201")'),
        description: z.string().optional().describe('Description'),
        cost: z.number().min(0).optional().describe('Unit cost'),
        url: z.string().url().optional().describe('Purchase link'),
      },
      async (params) => {
        try {
          const part = await createPart(params);
          return {
            content: [{
              type: 'text',
              text: `✅ Part registered!\n\n` +
                    `• ID: ${part.id}\n` +
                    `• Name: ${part.name}\n` +
                    (part.manufacturer ? `• Manufacturer: ${part.manufacturer}\n` : '') +
                    (part.partNumber ? `• Part #: ${part.partNumber}\n` : '') +
                    (part.cost ? `• Cost: $${part.cost.toFixed(2)}\n` : '') +
                    (part.url ? `• URL: ${part.url}\n` : '')
            }]
          };
        } catch (error) {
          console.error('Error in vehicle_add_part:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Get parts
    server.tool(
      'vehicle_get_parts',
      'List or search registered parts',
      {
        search: z.string().optional().describe('Search by name, manufacturer, or part number'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
      },
      async (params) => {
        try {
          const parts = await getParts(params);

          if (parts.length === 0) {
            return {
              content: [{ type: 'text', text: params.search
                ? `No parts found matching "${params.search}".`
                : 'No parts registered. Use vehicle_add_part to add one.' }]
            };
          }

          const partList = parts.map(p =>
            `• **${p.name}** (ID: ${p.id})\n` +
            (p.manufacturer ? `  Manufacturer: ${p.manufacturer}\n` : '') +
            (p.partNumber ? `  Part #: ${p.partNumber}\n` : '') +
            (p.cost ? `  Cost: $${p.cost.toFixed(2)}\n` : '')
          ).join('\n');

          return {
            content: [{ type: 'text', text: `🔧 Parts (${parts.length}):\n\n${partList}` }]
          };
        } catch (error) {
          console.error('Error in vehicle_get_parts:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Set maintenance schedule
    server.tool(
      'vehicle_set_schedule',
      'Create, update, or delete a maintenance schedule',
      {
        action: z.enum(['create', 'update', 'delete']).describe('Action to perform'),
        // For create
        vehicleId: z.string().uuid().optional().describe('Vehicle ID (required for create)'),
        name: z.string().max(100).optional().describe('Schedule name (e.g., "Oil Change")'),
        serviceType: z.string().optional().describe('Service type that this schedule tracks'),
        intervalKm: z.number().int().min(1).optional().describe('Interval in kilometers'),
        intervalMonths: z.number().int().min(1).optional().describe('Interval in months'),
        lastPerformedDate: z.string().optional().describe('Last service date (YYYY-MM-DD)'),
        lastPerformedOdometer: z.number().int().min(0).optional().describe('Odometer at last service'),
        notes: z.string().optional().describe('Notes'),
        // For update/delete
        scheduleId: z.string().uuid().optional().describe('Schedule ID (required for update/delete)'),
        enabled: z.boolean().optional().describe('Enable or disable the schedule'),
      },
      async (params) => {
        try {
          if (params.action === 'create') {
            if (!params.vehicleId || !params.name || !params.serviceType) {
              return {
                content: [{ type: 'text', text: '❌ vehicleId, name, and serviceType are required for create.' }]
              };
            }
            if (!params.intervalKm && !params.intervalMonths) {
              return {
                content: [{ type: 'text', text: '❌ At least one of intervalKm or intervalMonths is required.' }]
              };
            }

            const schedule = await createMaintenanceSchedule({
              vehicleId: params.vehicleId,
              name: params.name,
              serviceType: params.serviceType,
              intervalKm: params.intervalKm,
              intervalMonths: params.intervalMonths,
              lastPerformedDate: params.lastPerformedDate ? new Date(params.lastPerformedDate) : undefined,
              lastPerformedOdometer: params.lastPerformedOdometer,
              notes: params.notes,
            });

            return {
              content: [{
                type: 'text',
                text: `✅ Maintenance schedule created!\n\n` +
                      `• ID: ${schedule.id}\n` +
                      `• Name: ${schedule.name}\n` +
                      `• Service Type: ${schedule.serviceType}\n` +
                      (schedule.intervalKm ? `• Every: ${schedule.intervalKm.toLocaleString()} km\n` : '') +
                      (schedule.intervalMonths ? `• Every: ${schedule.intervalMonths} months\n` : '')
              }]
            };
          }

          if (params.action === 'delete') {
            if (!params.scheduleId) {
              return {
                content: [{ type: 'text', text: '❌ scheduleId is required for delete.' }]
              };
            }
            await deleteMaintenanceSchedule(params.scheduleId);
            return {
              content: [{ type: 'text', text: '✅ Maintenance schedule deleted.' }]
            };
          }

          if (params.action === 'update') {
            if (!params.scheduleId) {
              return {
                content: [{ type: 'text', text: '❌ scheduleId is required for update.' }]
              };
            }
            const updateData: Record<string, unknown> = {};
            if (params.name) updateData.name = params.name;
            if (params.serviceType) updateData.serviceType = params.serviceType;
            if (params.intervalKm !== undefined) updateData.intervalKm = params.intervalKm;
            if (params.intervalMonths !== undefined) updateData.intervalMonths = params.intervalMonths;
            if (params.lastPerformedDate) updateData.lastPerformedDate = new Date(params.lastPerformedDate);
            if (params.lastPerformedOdometer !== undefined) updateData.lastPerformedOdometer = params.lastPerformedOdometer;
            if (params.enabled !== undefined) updateData.enabled = params.enabled;
            if (params.notes !== undefined) updateData.notes = params.notes;

            const schedule = await updateMaintenanceSchedule(params.scheduleId, updateData);
            return {
              content: [{
                type: 'text',
                text: `✅ Schedule updated!\n\n` +
                      `• Name: ${schedule.name}\n` +
                      `• Enabled: ${schedule.enabled ? 'Yes' : 'No'}`
              }]
            };
          }

          return {
            content: [{ type: 'text', text: '❌ Invalid action.' }]
          };
        } catch (error) {
          console.error('Error in vehicle_set_schedule:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Get maintenance schedules
    server.tool(
      'vehicle_get_schedules',
      'List maintenance schedules for a vehicle',
      {
        vehicleId: z.string().uuid().describe('Vehicle ID'),
        enabledOnly: z.boolean().optional().describe('Only show enabled schedules (default: true)'),
      },
      async (params) => {
        try {
          const schedules = await getMaintenanceSchedules(params);

          if (schedules.length === 0) {
            return {
              content: [{ type: 'text', text: 'No maintenance schedules found for this vehicle.' }]
            };
          }

          const scheduleList = schedules.map(s => {
            let entry = `• **${s.name}** (${s.serviceType})\n` +
              `  ID: ${s.id}\n`;
            if (s.intervalKm) entry += `  Every: ${s.intervalKm.toLocaleString()} km\n`;
            if (s.intervalMonths) entry += `  Every: ${s.intervalMonths} months\n`;
            if (s.lastPerformedDate) {
              entry += `  Last: ${s.lastPerformedDate.toISOString().split('T')[0]}`;
              if (s.lastPerformedOdometer) entry += ` @ ${s.lastPerformedOdometer.toLocaleString()} km`;
              entry += '\n';
            }
            entry += `  Status: ${s.enabled ? '✅ Active' : '⏸️ Disabled'}`;
            return entry;
          }).join('\n\n');

          return {
            content: [{ type: 'text', text: `📅 Maintenance Schedules:\n\n${scheduleList}` }]
          };
        } catch (error) {
          console.error('Error in vehicle_get_schedules:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Get upcoming maintenance
    server.tool(
      'vehicle_get_upcoming',
      'Get overdue and upcoming maintenance items',
      {
        vehicleId: z.string().uuid().optional().describe('Filter by vehicle (default: all vehicles)'),
        withinKm: z.number().int().min(0).optional().describe('Show items due within X km (default: 1000)'),
        withinMonths: z.number().int().min(0).optional().describe('Show items due within X months (default: 1)'),
      },
      async (params) => {
        try {
          const items = await getUpcomingMaintenance(params);

          if (items.length === 0) {
            return {
              content: [{ type: 'text', text: '✅ No maintenance is currently due or upcoming!' }]
            };
          }

          const overdueItems = items.filter(i => i.status === 'overdue');
          const dueSoonItems = items.filter(i => i.status === 'due_soon');

          let response = '';

          if (overdueItems.length > 0) {
            response += `🚨 **OVERDUE** (${overdueItems.length}):\n\n`;
            overdueItems.forEach(item => {
              response += `• **${item.name}** - ${item.vehicleName}\n`;
              if (item.kmOverdue) response += `  ⚠️ ${item.kmOverdue.toLocaleString()} km overdue\n`;
              if (item.daysOverdue) response += `  ⚠️ ${item.daysOverdue} days overdue\n`;
              response += '\n';
            });
          }

          if (dueSoonItems.length > 0) {
            response += `⏰ **DUE SOON** (${dueSoonItems.length}):\n\n`;
            dueSoonItems.forEach(item => {
              response += `• **${item.name}** - ${item.vehicleName}\n`;
              if (item.kmUntilDue) response += `  📏 Due in ${item.kmUntilDue.toLocaleString()} km\n`;
              if (item.daysUntilDue) response += `  📅 Due in ${item.daysUntilDue} days\n`;
              response += '\n';
            });
          }

          return {
            content: [{ type: 'text', text: response.trim() }]
          };
        } catch (error) {
          console.error('Error in vehicle_get_upcoming:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // ==========================================
    // Budget & Expense Tracking Tools
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
              text: `✅ Budget category ${category.id ? 'updated' : 'created'}!\n\n` +
                    `• Name: ${category.name}\n` +
                    `• Period: ${category.period}\n` +
                    `• Amount: $${category.budgetAmount.toFixed(2)}\n` +
                    (category.parentName ? `• Parent: ${category.parentName}\n` : '')
            }]
          };
        } catch (error) {
          console.error('Error in budget_set_category:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
            let line = `${indent}• **${cat.name}** (${cat.period})\n`;
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
            content: [{ type: 'text', text: `💰 Budget Categories:\n\n${categoryList}` }]
          };
        } catch (error) {
          console.error('Error in budget_get_categories:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
            content: [{ type: 'text', text: `✅ Category "${params.name}" deleted.` }]
          };
        } catch (error) {
          console.error('Error in budget_delete_category:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

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
              content: [{ type: 'text', text: '❌ Invalid date format. Use YYYY-MM-DD.' }]
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
              text: `✅ Expense recorded!\n\n` +
                    `• Date: ${expense.date.toISOString().split('T')[0]}\n` +
                    `• Amount: $${expense.amount.toFixed(2)}\n` +
                    `• Category: ${expense.categoryName}\n` +
                    `• Description: ${expense.description}\n` +
                    (expense.merchantName ? `• Merchant: ${expense.merchantName}\n` : '')
            }]
          };
        } catch (error) {
          console.error('Error in expense_add:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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

          let response = `📥 Import Results:\n\n`;
          response += `• Imported: ${result.imported}\n`;
          response += `• Skipped (duplicates): ${result.skipped}\n`;
          response += `• Uncategorized: ${result.uncategorized.length}\n`;

          if (result.errors.length > 0) {
            response += `\n⚠️ Errors:\n`;
            result.errors.slice(0, 5).forEach(err => {
              response += `  • ${err}\n`;
            });
            if (result.errors.length > 5) {
              response += `  ... and ${result.errors.length - 5} more errors\n`;
            }
          }

          if (result.uncategorized.length > 0) {
            response += `\n📋 Uncategorized items (need manual categorization):\n`;
            result.uncategorized.slice(0, 10).forEach(item => {
              response += `  • ${item.date}: $${item.amount.toFixed(2)} - ${item.description.substring(0, 50)}\n`;
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
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
              `• **${exp.date.toISOString().split('T')[0]}** - $${exp.amount.toFixed(2)}\n` +
              `  ${exp.description}` +
              (exp.merchantName ? ` (${exp.merchantName})` : '') +
              ` [${exp.categoryName}]`
            ).join('\n\n');

            const showingText = expenses.length > 10 ? ` (showing first 10 of ${expenses.length} returned)` : '';

            return {
              content: [{
                type: 'text',
                text: `💸 **Expense Search Results**${params.searchTerm ? ` for "${params.searchTerm}"` : ''}\n\n` +
                      `📊 **Aggregates (all ${agg.count} matching expenses):**\n` +
                      `• Total: **$${agg.totalAmount.toFixed(2)}**\n` +
                      `• Count: ${agg.count} transactions\n` +
                      `• Average: $${agg.averageAmount.toFixed(2)}\n` +
                      `• Range: $${agg.minAmount.toFixed(2)} - $${agg.maxAmount.toFixed(2)}\n\n` +
                      `📋 **Sample Transactions**${showingText}:\n\n${expenseList}`
              }]
            };
          }

          // Standard response (array of expenses)
          const expenses = result as Awaited<ReturnType<typeof getExpenses>> extends (infer T)[] ? T[] : never;

          if (!Array.isArray(result) || result.length === 0) {
            return {
              content: [{ type: 'text', text: 'No expenses found matching your criteria.' }]
            };
          }

          const total = result.reduce((sum, exp) => sum + exp.amount, 0);
          const expenseList = result.map(exp =>
            `• **${exp.date.toISOString().split('T')[0]}** - $${exp.amount.toFixed(2)}\n` +
            `  ID: ${exp.id}\n` +
            `  Category: ${exp.categoryName}\n` +
            `  ${exp.description}` +
            (exp.merchantName ? ` (${exp.merchantName})` : '')
          ).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `💸 Expenses (${result.length} items, Total: $${total.toFixed(2)}):\n\n${expenseList}`
            }]
          };
        } catch (error) {
          console.error('Error in expense_get:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
              text: `✅ Expense updated!\n\n` +
                    `• Date: ${expense.date.toISOString().split('T')[0]}\n` +
                    `• Amount: $${expense.amount.toFixed(2)}\n` +
                    `• Category: ${expense.categoryName}\n` +
                    `• Description: ${expense.description}`
            }]
          };
        } catch (error) {
          console.error('Error in expense_update:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
            content: [{ type: 'text', text: '✅ Expense deleted.' }]
          };
        } catch (error) {
          console.error('Error in expense_delete:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

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

          let response = `📊 Budget Summary (${summary.period})\n`;
          response += `Period: ${summary.startDate.toISOString().split('T')[0]} to ${summary.endDate.toISOString().split('T')[0]}\n\n`;

          const formatVariance = (variance: number) => {
            if (variance >= 0) return `✅ $${variance.toFixed(2)} under`;
            return `🔴 $${Math.abs(variance).toFixed(2)} over`;
          };

          summary.categories.forEach(cat => {
            response += `**${cat.categoryName}**\n`;
            response += `  Budget: $${cat.budgetAmount.toFixed(2)} | Spent: $${cat.actualAmount.toFixed(2)}\n`;
            response += `  ${formatVariance(cat.variance)} (${cat.percentUsed.toFixed(0)}%)\n`;

            if (cat.children && cat.children.length > 0) {
              cat.children.forEach(child => {
                response += `    • ${child.categoryName}: $${child.actualAmount.toFixed(2)} / $${child.budgetAmount.toFixed(2)}\n`;
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
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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

          let response = `💵 Financial Balance (${balance.period})\n`;
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

          const actualStatus = balance.balance.actual >= 0 ? '✅ In the green!' : '🔴 In deficit';
          response += `\n${actualStatus}`;

          return {
            content: [{ type: 'text', text: response }]
          };
        } catch (error) {
          console.error('Error in budget_get_balance:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

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
              text: `✅ Income source configured!\n\n` +
                    `• Name: ${source.name}\n` +
                    `• Expected: $${source.expectedAmount.toFixed(2)}/month\n` +
                    `• Pay Day: ${source.payDay === 31 ? 'End of month' : `Day ${source.payDay}`}`
            }]
          };
        } catch (error) {
          console.error('Error in income_set_source:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
            `• **${src.name}**\n` +
            `  ID: ${src.id}\n` +
            `  Expected: $${src.expectedAmount.toFixed(2)}/month\n` +
            `  Pay Day: ${src.payDay === 31 ? 'End of month' : `Day ${src.payDay}`}`
          ).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `💼 Income Sources (Total: $${total.toFixed(2)}/month):\n\n${sourceList}`
            }]
          };
        } catch (error) {
          console.error('Error in income_get_sources:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
              content: [{ type: 'text', text: '❌ Invalid date format. Use YYYY-MM-DD.' }]
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
              text: `✅ Income recorded!\n\n` +
                    `• Source: ${income.sourceName}\n` +
                    `• Date: ${income.date.toISOString().split('T')[0]}\n` +
                    `• Amount: $${income.amount.toFixed(2)}`
            }]
          };
        } catch (error) {
          console.error('Error in income_add:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
            `• **${inc.date.toISOString().split('T')[0]}** - $${inc.amount.toFixed(2)}\n` +
            `  ID: ${inc.id}\n` +
            `  Source: ${inc.sourceName}` +
            (inc.description ? `\n  ${inc.description}` : '')
          ).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `💰 Income Records (${incomes.length} items, Total: $${total.toFixed(2)}):\n\n${incomeList}`
            }]
          };
        } catch (error) {
          console.error('Error in income_get:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
            content: [{ type: 'text', text: `✅ Income record "${params.id}" deleted.` }]
          };
        } catch (error) {
          console.error('Error in income_delete:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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

          let response = `📊 Annual Budget Summary (${summary.year})\n`;
          response += `Period: ${summary.startDate.toISOString().split('T')[0]} to ${summary.endDate.toISOString().split('T')[0]}\n\n`;

          const formatVariance = (variance: number) => {
            if (variance >= 0) return `✅ $${variance.toFixed(2)} under`;
            return `🔴 $${Math.abs(variance).toFixed(2)} over`;
          };

          for (const cat of summary.categories) {
            response += `**${cat.categoryName}** (${cat.period} → Annual)\n`;
            response += `  Budget: $${cat.periodBudget.toFixed(2)}/${cat.period.toLowerCase()} = $${cat.annualizedBudget.toFixed(2)}/year\n`;
            response += `  YTD Actual: $${cat.ytdActual.toFixed(2)}\n`;
            response += `  ${formatVariance(cat.variance)} (${cat.percentUsed.toFixed(0)}% used)\n`;

            if (cat.children && cat.children.length > 0) {
              for (const child of cat.children) {
                response += `    • ${child.categoryName}: $${child.ytdActual.toFixed(2)} / $${child.annualizedBudget.toFixed(2)} (${child.percentUsed.toFixed(0)}%)\n`;
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
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
              content: [{ type: 'text', text: '❌ Invalid date format. Use YYYY-MM-DD.' }]
            };
          }

          const totals = await getExpenseTotals({
            startDate: start,
            endDate: end,
            groupBy: params.groupBy as ExpenseGroupBy,
          });

          let response = `📊 Expense Totals by ${params.groupBy}\n`;
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
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
              content: [{ type: 'text', text: '❌ Invalid date format. Use YYYY-MM-DD.' }]
            };
          }

          const totals = await getIncomeTotals({
            startDate: start,
            endDate: end,
            groupBy: params.groupBy as IncomeGroupBy,
          });

          let response = `💵 Income Totals by ${params.groupBy}\n`;
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
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
              case 'on_track': return '✅';
              case 'warning': return '⚠️';
              case 'over_budget': return '🔴';
              default: return '❓';
            }
          };

          let response = `📊 Budget vs Actuals (${comparison.year})\n`;
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
                response += `|   ↳ ${child.categoryName} | $${child.annualizedBudget.toFixed(0)} | $${child.ytdActual.toFixed(0)} | ${childVariance} | ${child.percentUsed.toFixed(0)}% | ${statusIcon(child.status)} |\n`;
              }
            }
          }

          response += `\n---\n`;
          response += `**SUMMARY**\n`;
          response += `• Annual Budget: $${comparison.totals.annualizedBudget.toFixed(2)}\n`;
          response += `• YTD Spending: $${comparison.totals.ytdActual.toFixed(2)} (${comparison.totals.percentUsed.toFixed(1)}%)\n`;
          response += `• Current Variance: ${comparison.totals.variance >= 0 ? '+' : '-'}$${Math.abs(comparison.totals.variance).toFixed(2)}\n`;
          response += `\n**PROJECTIONS**\n`;
          response += `• Projected Year-End Spending: $${comparison.totals.projectedYearEnd.toFixed(2)}\n`;
          response += `• Projected Variance: ${comparison.totals.projectedVariance >= 0 ? '+' : '-'}$${Math.abs(comparison.totals.projectedVariance).toFixed(2)}\n`;
          response += comparison.totals.projectedVariance >= 0 ? '✅ On track to stay under budget' : '🔴 Projected to exceed budget';

          return {
            content: [{ type: 'text', text: response }]
          };
        } catch (error) {
          console.error('Error in budget_vs_actuals:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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

          let response = `📊 **Expense Analytics**${params.searchTerm ? ` (filtered: "${params.searchTerm}")` : ''}\n`;
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
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
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
              case 'alert': return '🔴';
              case 'warning': return '⚠️';
              case 'info': return 'ℹ️';
              default: return '•';
            }
          };

          let response = `💡 **Spending Insights** (${insights.period})\n`;
          response += `Period: ${insights.startDate.toISOString().split('T')[0]} to ${insights.endDate.toISOString().split('T')[0]}\n\n`;

          response += `📈 **Summary**\n`;
          response += `• Total Spent: $${insights.summary.totalSpent.toFixed(2)}\n`;
          response += `• Daily Average: $${insights.summary.averageDailySpend.toFixed(2)}\n`;
          response += `• Top Category: ${insights.summary.topCategory}\n`;
          response += `• Top Merchant: ${insights.summary.topMerchant}\n`;
          response += `• vs Previous Period: ${insights.summary.comparedToPreviousPeriod >= 0 ? '+' : ''}${insights.summary.comparedToPreviousPeriod.toFixed(1)}%\n\n`;

          if (insights.insights.length > 0) {
            response += `🔍 **Insights & Alerts**\n`;
            for (const insight of insights.insights) {
              response += `${severityIcon(insight.severity)} **${insight.title}**\n`;
              response += `   ${insight.description}\n`;
            }
          } else {
            response += `✅ No notable insights for this period - spending looks normal.`;
          }

          return {
            content: [{ type: 'text', text: response }]
          };
        } catch (error) {
          console.error('Error in budget_spending_insights:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

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

    // ==========================================
    // Shopping & Purchase Intelligence Tools
    // ==========================================

    // Manage purchase categories
    server.tool(
      'shopping_manage_category',
      'Create, update, or delete purchase categories',
      {
        action: z.enum(['add', 'update', 'delete']).describe('Action to perform'),
        name: z.string().min(1).optional().describe('Category name'),
        newName: z.string().min(1).optional().describe('New category name (for update)'),
        parentName: z.string().optional().describe('Parent category name for hierarchy'),
        id: z.string().uuid().optional().describe('Category ID (for update/delete)'),
      },
      async (params) => {
        try {
          const { action, name, newName, parentName, id } = params;

          if (action === 'add') {
            if (!name) throw new Error('Category name is required');

            let parentId = undefined;
            if (parentName) {
              const parent = await prisma.purchaseCategory.findUnique({
                where: { name: parentName }
              });
              if (!parent) throw new Error(`Parent category "${parentName}" not found`);
              parentId = parent.id;
            }

            const category = await prisma.purchaseCategory.create({
              data: { name, parentId }
            });

            return {
              content: [{
                type: 'text',
                text: `✅ Category "${category.name}" created` + (parentName ? ` under "${parentName}"` : '')
              }]
            };
          }

          if (action === 'update') {
            if (!id && !name) throw new Error('Category ID or name is required');
            if (!newName) throw new Error('New name is required for update');

            const category = await prisma.purchaseCategory.update({
              where: id ? { id } : { name: name! },
              data: { name: newName }
            });

            return {
              content: [{ type: 'text', text: `✅ Category updated to "${category.name}"` }]
            };
          }

          if (action === 'delete') {
            if (!id && !name) throw new Error('Category ID or name is required');

            await prisma.purchaseCategory.delete({
              where: id ? { id } : { name: name! }
            });

            return {
              content: [{ type: 'text', text: `✅ Category deleted` }]
            };
          }

          throw new Error('Invalid action');
        } catch (error) {
          console.error('Error in shopping_manage_category:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // List purchase categories
    server.tool(
      'shopping_get_categories',
      'List all purchase categories with hierarchy',
      {},
      async () => {
        try {
          const categories = await prisma.purchaseCategory.findMany({
            include: {
              parent: true,
              _count: {
                select: { purchases: true, wishlist: true }
              }
            },
            orderBy: { name: 'asc' }
          });

          const categoryList = categories.map(cat =>
            `• ${cat.name}${cat.parent ? ` (under ${cat.parent.name})` : ''}\n` +
            `  Purchases: ${cat._count.purchases}, Wishlist: ${cat._count.wishlist}`
          ).join('\n');

          return {
            content: [{ type: 'text', text: `📂 Purchase Categories (${categories.length}):\n\n${categoryList}` }]
          };
        } catch (error) {
          console.error('Error in shopping_get_categories:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Add purchase history
    server.tool(
      'shopping_add_purchase',
      'Record a past purchase to build your purchase history',
      {
        itemName: z.string().min(1).describe('Name/description of the item purchased'),
        categoryName: z.string().min(1).describe('Purchase category name'),
        price: z.number().positive().describe('Purchase price'),
        purchaseDate: z.string().describe('Purchase date (YYYY-MM-DD)'),
        quantity: z.number().int().positive().default(1).optional().describe('Quantity purchased'),
        merchant: z.string().optional().describe('Store or merchant name'),
        brand: z.string().optional().describe('Product brand'),
        productUrl: z.string().url().optional().describe('Product URL'),
        notes: z.string().optional().describe('Additional notes'),
      },
      async (params) => {
        try {
          const category = await prisma.purchaseCategory.findUnique({
            where: { name: params.categoryName }
          });

          if (!category) {
            throw new Error(`Category "${params.categoryName}" not found. Create it first with shopping_manage_category.`);
          }

          const purchase = await prisma.purchaseHistory.create({
            data: {
              itemName: params.itemName,
              categoryId: category.id,
              price: params.price,
              purchaseDate: new Date(params.purchaseDate),
              quantity: params.quantity || 1,
              merchant: params.merchant,
              brand: params.brand,
              productUrl: params.productUrl,
              notes: params.notes,
            },
            include: { category: true }
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Purchase recorded:\n\n` +
                    `• ${purchase.itemName} (${purchase.quantity}x)\n` +
                    `• $${purchase.price}\n` +
                    `• Category: ${purchase.category.name}\n` +
                    `• Date: ${purchase.purchaseDate.toISOString().split('T')[0]}` +
                    (purchase.merchant ? `\n• Merchant: ${purchase.merchant}` : '') +
                    (purchase.brand ? `\n• Brand: ${purchase.brand}` : '')
            }]
          };
        } catch (error) {
          console.error('Error in shopping_add_purchase:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Import purchases from CSV
    server.tool(
      'shopping_import_purchases',
      'Bulk import purchase history from CSV data. Handles quoted fields with commas, skips duplicates.',
      {
        csvData: z.string().min(1).describe('CSV data with headers'),
        dateColumn: z.string().describe('Column name for purchase date'),
        itemColumn: z.string().describe('Column name for item name'),
        priceColumn: z.string().describe('Column name for price'),
        categoryColumn: z.string().optional().describe('Column name for category'),
        merchantColumn: z.string().optional().describe('Column name for merchant'),
        brandColumn: z.string().optional().describe('Column name for brand'),
        defaultCategory: z.string().optional().describe('Default category if not in CSV'),
      },
      async (params) => {
        try {
          // Parse CSV properly handling quoted fields with commas
          function parseCSVLine(line: string): string[] {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              const nextChar = line[i + 1];

              if (char === '"' && inQuotes && nextChar === '"') {
                // Escaped quote inside quoted field
                current += '"';
                i++; // Skip next quote
              } else if (char === '"') {
                // Toggle quote mode
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          }

          const lines = params.csvData.trim().split('\n');
          if (lines.length < 2) throw new Error('CSV must have headers and at least one data row');

          const headers = parseCSVLine(lines[0]);
          const dateIdx = headers.indexOf(params.dateColumn);
          const itemIdx = headers.indexOf(params.itemColumn);
          const priceIdx = headers.indexOf(params.priceColumn);
          const categoryIdx = params.categoryColumn ? headers.indexOf(params.categoryColumn) : -1;
          const merchantIdx = params.merchantColumn ? headers.indexOf(params.merchantColumn) : -1;
          const brandIdx = params.brandColumn ? headers.indexOf(params.brandColumn) : -1;

          if (dateIdx === -1 || itemIdx === -1 || priceIdx === -1) {
            throw new Error(`Required columns not found. Headers: ${headers.join(', ')}`);
          }

          // Parse all rows first
          const parsedRows: Array<{
            date: Date;
            itemName: string;
            price: number;
            categoryName: string;
            merchant?: string;
            brand?: string;
            rowNum: number;
          }> = [];
          const parseErrors: string[] = [];

          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue; // Skip empty lines

            try {
              const cols = parseCSVLine(lines[i]);
              const categoryName = (categoryIdx >= 0 ? cols[categoryIdx] : params.defaultCategory) || '';
              if (!categoryName) throw new Error('Category required');

              const dateStr = cols[dateIdx];
              const parsedDate = new Date(dateStr);
              if (isNaN(parsedDate.getTime())) throw new Error(`Invalid date: ${dateStr}`);

              const priceStr = cols[priceIdx];
              const price = parseFloat(priceStr.replace(/[^0-9.-]/g, ''));
              if (isNaN(price)) throw new Error(`Invalid price: ${priceStr}`);

              parsedRows.push({
                date: parsedDate,
                itemName: cols[itemIdx],
                price,
                categoryName,
                merchant: merchantIdx >= 0 && cols[merchantIdx] ? cols[merchantIdx] : undefined,
                brand: brandIdx >= 0 && cols[brandIdx] ? cols[brandIdx] : undefined,
                rowNum: i + 1,
              });
            } catch (err) {
              parseErrors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
            }
          }

          if (parsedRows.length === 0) {
            throw new Error('No valid rows to import');
          }

          // Get unique category names and ensure they exist
          const uniqueCategories = [...new Set(parsedRows.map(r => r.categoryName))];
          const categoryMap = new Map<string, string>();

          for (const catName of uniqueCategories) {
            let category = await prisma.purchaseCategory.findUnique({
              where: { name: catName }
            });
            if (!category) {
              category = await prisma.purchaseCategory.create({
                data: { name: catName }
              });
            }
            categoryMap.set(catName, category.id);
          }

          // Check for duplicates (same date, item, price)
          const existingPurchases = await prisma.purchaseHistory.findMany({
            where: {
              OR: parsedRows.map(r => ({
                purchaseDate: r.date,
                itemName: r.itemName,
                price: r.price,
              }))
            },
            select: { purchaseDate: true, itemName: true, price: true }
          });

          const existingSet = new Set(
            existingPurchases.map(p =>
              `${p.purchaseDate.toISOString()}|${p.itemName}|${p.price}`
            )
          );

          // Filter out duplicates
          const newRows = parsedRows.filter(r => {
            const key = `${r.date.toISOString()}|${r.itemName}|${r.price}`;
            return !existingSet.has(key);
          });
          const skippedCount = parsedRows.length - newRows.length;

          // Batch insert new records
          let importedCount = 0;
          if (newRows.length > 0) {
            const result = await prisma.purchaseHistory.createMany({
              data: newRows.map(r => ({
                purchaseDate: r.date,
                itemName: r.itemName,
                price: r.price,
                categoryId: categoryMap.get(r.categoryName)!,
                merchant: r.merchant,
                brand: r.brand,
              })),
              skipDuplicates: true,
            });
            importedCount = result.count;
          }

          const summary = [
            `✅ Import complete!`,
            ``,
            `• Imported: ${importedCount} purchases`,
            skippedCount > 0 ? `• Skipped (duplicates): ${skippedCount}` : null,
            parseErrors.length > 0 ? `• Parse errors: ${parseErrors.length}` : null,
          ].filter(Boolean).join('\n');

          const errorDetails = parseErrors.length > 0
            ? `\n\nParse errors:\n${parseErrors.slice(0, 10).join('\n')}${parseErrors.length > 10 ? `\n...and ${parseErrors.length - 10} more` : ''}`
            : '';

          return {
            content: [{ type: 'text', text: summary + errorDetails }]
          };
        } catch (error) {
          console.error('Error in shopping_import_purchases:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Get purchase history
    server.tool(
      'shopping_get_purchases',
      'Query purchase history with flexible filters',
      {
        categoryName: z.string().optional().describe('Filter by category name'),
        merchant: z.string().optional().describe('Filter by merchant'),
        brand: z.string().optional().describe('Filter by brand'),
        startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
        minPrice: z.number().optional().describe('Minimum price'),
        maxPrice: z.number().optional().describe('Maximum price'),
        limit: z.number().int().min(1).max(100).default(20).describe('Max results to return'),
      },
      async (params) => {
        try {
          const where: any = {};

          if (params.categoryName) {
            const category = await prisma.purchaseCategory.findUnique({
              where: { name: params.categoryName }
            });
            if (category) where.categoryId = category.id;
          }

          if (params.merchant) where.merchant = { contains: params.merchant, mode: 'insensitive' };
          if (params.brand) where.brand = { contains: params.brand, mode: 'insensitive' };

          if (params.startDate || params.endDate) {
            where.purchaseDate = {};
            if (params.startDate) where.purchaseDate.gte = new Date(params.startDate);
            if (params.endDate) where.purchaseDate.lte = new Date(params.endDate);
          }

          if (params.minPrice || params.maxPrice) {
            where.price = {};
            if (params.minPrice) where.price.gte = params.minPrice;
            if (params.maxPrice) where.price.lte = params.maxPrice;
          }

          const purchases = await prisma.purchaseHistory.findMany({
            where,
            include: { category: true },
            orderBy: { purchaseDate: 'desc' },
            take: params.limit,
          });

          if (purchases.length === 0) {
            return {
              content: [{ type: 'text', text: '📦 No purchases found matching the filters.' }]
            };
          }

          const purchaseList = purchases.map(p =>
            `• ${p.itemName} - $${p.price} (${p.quantity}x)\n` +
            `  ${p.purchaseDate.toISOString().split('T')[0]} | ${p.category.name}` +
            (p.merchant ? ` | ${p.merchant}` : '') +
            (p.brand ? ` | ${p.brand}` : '')
          ).join('\n\n');

          const total = purchases.reduce((sum, p) => sum + Number(p.price) * p.quantity, 0);

          return {
            content: [{
              type: 'text',
              text: `🛍️ Purchase History (${purchases.length}):\n\n${purchaseList}\n\n` +
                    `💰 Total: $${total.toFixed(2)}`
            }]
          };
        } catch (error) {
          console.error('Error in shopping_get_purchases:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Update single purchase
    server.tool(
      'shopping_update_purchase',
      'Update a single purchase record by ID',
      {
        id: z.string().uuid().describe('Purchase ID to update'),
        itemName: z.string().min(1).optional().describe('New item name'),
        categoryName: z.string().min(1).optional().describe('New category name'),
        price: z.number().positive().optional().describe('New price'),
        purchaseDate: z.string().optional().describe('New purchase date (YYYY-MM-DD)'),
        quantity: z.number().int().positive().optional().describe('New quantity'),
        merchant: z.string().optional().describe('New merchant (empty string to clear)'),
        brand: z.string().optional().describe('New brand (empty string to clear)'),
        notes: z.string().optional().describe('New notes (empty string to clear)'),
      },
      async (params) => {
        try {
          // Verify purchase exists
          const existing = await prisma.purchaseHistory.findUnique({
            where: { id: params.id },
            include: { category: true }
          });

          if (!existing) {
            return {
              content: [{ type: 'text', text: `❌ Purchase with ID "${params.id}" not found.` }]
            };
          }

          const updateData: any = {};

          if (params.itemName !== undefined) updateData.itemName = params.itemName;
          if (params.price !== undefined) updateData.price = params.price;
          if (params.purchaseDate !== undefined) updateData.purchaseDate = new Date(params.purchaseDate);
          if (params.quantity !== undefined) updateData.quantity = params.quantity;
          if (params.merchant !== undefined) updateData.merchant = params.merchant || null;
          if (params.brand !== undefined) updateData.brand = params.brand || null;
          if (params.notes !== undefined) updateData.notes = params.notes || null;

          if (params.categoryName !== undefined) {
            const category = await prisma.purchaseCategory.findUnique({
              where: { name: params.categoryName }
            });
            if (!category) {
              return {
                content: [{ type: 'text', text: `❌ Category "${params.categoryName}" not found. Create it first with shopping_manage_category.` }]
              };
            }
            updateData.categoryId = category.id;
          }

          if (Object.keys(updateData).length === 0) {
            return {
              content: [{ type: 'text', text: '⚠️ No fields provided to update.' }]
            };
          }

          const updated = await prisma.purchaseHistory.update({
            where: { id: params.id },
            data: updateData,
            include: { category: true }
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Purchase updated:\n\n` +
                    `• ${updated.itemName} (${updated.quantity}x)\n` +
                    `• $${updated.price}\n` +
                    `• Category: ${updated.category.name}\n` +
                    `• Date: ${updated.purchaseDate.toISOString().split('T')[0]}` +
                    (updated.merchant ? `\n• Merchant: ${updated.merchant}` : '') +
                    (updated.brand ? `\n• Brand: ${updated.brand}` : '') +
                    (updated.notes ? `\n• Notes: ${updated.notes}` : '')
            }]
          };
        } catch (error) {
          console.error('Error in shopping_update_purchase:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Bulk update purchases
    server.tool(
      'shopping_bulk_update_purchases',
      'Update multiple purchase records matching filter criteria. Use to recategorize, update merchant/brand, or correct data in bulk.',
      {
        // Filter criteria (at least one required)
        filterCategoryName: z.string().optional().describe('Filter: match purchases in this category'),
        filterMerchant: z.string().optional().describe('Filter: match purchases from this merchant (partial match)'),
        filterBrand: z.string().optional().describe('Filter: match purchases of this brand (partial match)'),
        filterStartDate: z.string().optional().describe('Filter: purchases on or after this date (YYYY-MM-DD)'),
        filterEndDate: z.string().optional().describe('Filter: purchases on or before this date (YYYY-MM-DD)'),
        filterMinPrice: z.number().optional().describe('Filter: minimum price'),
        filterMaxPrice: z.number().optional().describe('Filter: maximum price'),
        filterItemNameContains: z.string().optional().describe('Filter: item name contains this text (partial match)'),
        // Update fields
        newCategoryName: z.string().optional().describe('Update: set category to this'),
        newMerchant: z.string().optional().describe('Update: set merchant (empty string to clear)'),
        newBrand: z.string().optional().describe('Update: set brand (empty string to clear)'),
        // Safety
        dryRun: z.boolean().default(true).describe('Preview changes without applying (default: true)'),
      },
      async (params) => {
        try {
          // Build filter
          const where: any = {};

          if (params.filterCategoryName) {
            const category = await prisma.purchaseCategory.findUnique({
              where: { name: params.filterCategoryName }
            });
            if (category) where.categoryId = category.id;
            else {
              return {
                content: [{ type: 'text', text: `❌ Filter category "${params.filterCategoryName}" not found.` }]
              };
            }
          }

          if (params.filterMerchant) where.merchant = { contains: params.filterMerchant, mode: 'insensitive' };
          if (params.filterBrand) where.brand = { contains: params.filterBrand, mode: 'insensitive' };
          if (params.filterItemNameContains) where.itemName = { contains: params.filterItemNameContains, mode: 'insensitive' };

          if (params.filterStartDate || params.filterEndDate) {
            where.purchaseDate = {};
            if (params.filterStartDate) where.purchaseDate.gte = new Date(params.filterStartDate);
            if (params.filterEndDate) where.purchaseDate.lte = new Date(params.filterEndDate);
          }

          if (params.filterMinPrice || params.filterMaxPrice) {
            where.price = {};
            if (params.filterMinPrice) where.price.gte = params.filterMinPrice;
            if (params.filterMaxPrice) where.price.lte = params.filterMaxPrice;
          }

          // Ensure at least one filter is set
          if (Object.keys(where).length === 0) {
            return {
              content: [{ type: 'text', text: '❌ At least one filter criteria is required to prevent accidental bulk updates.' }]
            };
          }

          // Build update data
          const updateData: any = {};

          if (params.newCategoryName !== undefined) {
            const category = await prisma.purchaseCategory.findUnique({
              where: { name: params.newCategoryName }
            });
            if (!category) {
              return {
                content: [{ type: 'text', text: `❌ Target category "${params.newCategoryName}" not found. Create it first with shopping_manage_category.` }]
              };
            }
            updateData.categoryId = category.id;
          }

          if (params.newMerchant !== undefined) updateData.merchant = params.newMerchant || null;
          if (params.newBrand !== undefined) updateData.brand = params.newBrand || null;

          if (Object.keys(updateData).length === 0) {
            return {
              content: [{ type: 'text', text: '❌ At least one update field (newCategoryName, newMerchant, newBrand) is required.' }]
            };
          }

          // Find matching records
          const matches = await prisma.purchaseHistory.findMany({
            where,
            include: { category: true },
            orderBy: { purchaseDate: 'desc' },
            take: 100 // Limit preview
          });

          const totalCount = await prisma.purchaseHistory.count({ where });

          if (totalCount === 0) {
            return {
              content: [{ type: 'text', text: '📦 No purchases found matching the filter criteria.' }]
            };
          }

          // Build preview
          const preview = matches.slice(0, 10).map(p =>
            `• ${p.itemName} - $${p.price} | ${p.purchaseDate.toISOString().split('T')[0]} | ${p.category.name}` +
            (p.merchant ? ` | ${p.merchant}` : '') +
            (p.brand ? ` | ${p.brand}` : '')
          ).join('\n');

          const updateSummary = Object.entries(updateData)
            .map(([key, value]) => {
              if (key === 'categoryId' && params.newCategoryName) return `Category → ${params.newCategoryName}`;
              if (key === 'merchant') return `Merchant → ${value || '(clear)'}`;
              if (key === 'brand') return `Brand → ${value || '(clear)'}`;
              return `${key} → ${value}`;
            })
            .join(', ');

          if (params.dryRun) {
            return {
              content: [{
                type: 'text',
                text: `🔍 DRY RUN - Preview of bulk update:\n\n` +
                      `📊 Matching records: ${totalCount}\n` +
                      `✏️ Changes: ${updateSummary}\n\n` +
                      `Sample of affected records${totalCount > 10 ? ` (showing 10 of ${totalCount})` : ''}:\n${preview}\n\n` +
                      `⚠️ To apply these changes, run again with dryRun: false`
              }]
            };
          }

          // Apply update
          const result = await prisma.purchaseHistory.updateMany({
            where,
            data: updateData
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Bulk update complete!\n\n` +
                    `📊 Records updated: ${result.count}\n` +
                    `✏️ Changes applied: ${updateSummary}`
            }]
          };
        } catch (error) {
          console.error('Error in shopping_bulk_update_purchases:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Add wishlist item
    server.tool(
      'shopping_add_wishlist',
      'Add an item to your wishlist for deal tracking',
      {
        itemName: z.string().min(1).describe('Item name or description'),
        categoryName: z.string().min(1).describe('Purchase category name'),
        targetPrice: z.number().positive().optional().describe('Target/desired price'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM').describe('Purchase priority'),
        brand: z.string().optional().describe('Preferred brand'),
        specifications: z.string().optional().describe('Specific requirements or specs'),
        productUrl: z.string().url().optional().describe('Reference product URL'),
        notes: z.string().optional().describe('Additional notes'),
      },
      async (params) => {
        try {
          const category = await prisma.purchaseCategory.findUnique({
            where: { name: params.categoryName }
          });

          if (!category) {
            throw new Error(`Category "${params.categoryName}" not found. Create it first with shopping_manage_category.`);
          }

          const wishlist = await prisma.wishlistItem.create({
            data: {
              itemName: params.itemName,
              categoryId: category.id,
              targetPrice: params.targetPrice,
              priority: params.priority as any,
              brand: params.brand,
              specifications: params.specifications,
              productUrl: params.productUrl,
              notes: params.notes,
            },
            include: { category: true }
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Added to wishlist:\n\n` +
                    `• ${wishlist.itemName}\n` +
                    `• Category: ${wishlist.category.name}\n` +
                    `• Priority: ${wishlist.priority}` +
                    (wishlist.targetPrice ? `\n• Target Price: $${wishlist.targetPrice}` : '') +
                    (wishlist.brand ? `\n• Brand: ${wishlist.brand}` : '')
            }]
          };
        } catch (error) {
          console.error('Error in shopping_add_wishlist:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Get wishlist
    server.tool(
      'shopping_get_wishlist',
      'View your wishlist with optional filters',
      {
        categoryName: z.string().optional().describe('Filter by category'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Filter by priority'),
        activeOnly: z.boolean().default(true).describe('Show only active items'),
      },
      async (params) => {
        try {
          const where: any = {};

          if (params.activeOnly) where.isActive = true;
          if (params.priority) where.priority = params.priority;

          if (params.categoryName) {
            const category = await prisma.purchaseCategory.findUnique({
              where: { name: params.categoryName }
            });
            if (category) where.categoryId = category.id;
          }

          const items = await prisma.wishlistItem.findMany({
            where,
            include: { category: true },
            orderBy: [
              { priority: 'desc' },
              { createdAt: 'desc' }
            ]
          });

          if (items.length === 0) {
            return {
              content: [{ type: 'text', text: '📝 No wishlist items found.' }]
            };
          }

          const priorityEmoji = { URGENT: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };

          const wishlistText = items.map(item =>
            `${priorityEmoji[item.priority]} ${item.itemName}\n` +
            `  Category: ${item.category.name}` +
            (item.targetPrice ? ` | Target: $${item.targetPrice}` : '') +
            (item.brand ? ` | Brand: ${item.brand}` : '') +
            (item.notes ? `\n  Notes: ${item.notes}` : '')
          ).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `🎯 Wishlist (${items.length} items):\n\n${wishlistText}`
            }]
          };
        } catch (error) {
          console.error('Error in shopping_get_wishlist:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Update wishlist item
    server.tool(
      'shopping_update_wishlist',
      'Update or delete a wishlist item',
      {
        itemId: z.string().uuid().describe('Wishlist item ID'),
        action: z.enum(['update', 'mark_inactive', 'delete']).describe('Action to perform'),
        itemName: z.string().optional().describe('New item name'),
        targetPrice: z.number().positive().optional().describe('New target price'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('New priority'),
        notes: z.string().optional().describe('New notes'),
      },
      async (params) => {
        try {
          if (params.action === 'delete') {
            await prisma.wishlistItem.delete({
              where: { id: params.itemId }
            });
            return {
              content: [{ type: 'text', text: '✅ Wishlist item deleted.' }]
            };
          }

          if (params.action === 'mark_inactive') {
            await prisma.wishlistItem.update({
              where: { id: params.itemId },
              data: { isActive: false }
            });
            return {
              content: [{ type: 'text', text: '✅ Wishlist item marked as inactive.' }]
            };
          }

          const updateData: any = {};
          if (params.itemName) updateData.itemName = params.itemName;
          if (params.targetPrice) updateData.targetPrice = params.targetPrice;
          if (params.priority) updateData.priority = params.priority;
          if (params.notes !== undefined) updateData.notes = params.notes;

          const item = await prisma.wishlistItem.update({
            where: { id: params.itemId },
            data: updateData,
            include: { category: true }
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Wishlist item updated:\n\n` +
                    `• ${item.itemName}\n` +
                    `• Priority: ${item.priority}` +
                    (item.targetPrice ? `\n• Target: $${item.targetPrice}` : '')
            }]
          };
        } catch (error) {
          console.error('Error in shopping_update_wishlist:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Get or create shopping profile
    server.tool(
      'shopping_get_profile',
      'Get your shopping profile with purchase insights and preferences',
      {},
      async () => {
        try {
          // Get or create default profile
          let profile = await prisma.shoppingProfile.findUnique({
            where: { profileName: 'default' }
          });

          if (!profile) {
            profile = await prisma.shoppingProfile.create({
              data: { profileName: 'default' }
            });
          }

          // Generate insights from purchase history
          const purchases = await prisma.purchaseHistory.findMany({
            include: { category: true },
            orderBy: { purchaseDate: 'desc' },
            take: 500 // Last 500 purchases for analysis
          });

          const categorySpending: Record<string, { count: number; total: number }> = {};
          const merchantFrequency: Record<string, number> = {};
          const brandPreference: Record<string, number> = {};

          purchases.forEach(p => {
            // Category analysis
            if (!categorySpending[p.category.name]) {
              categorySpending[p.category.name] = { count: 0, total: 0 };
            }
            categorySpending[p.category.name].count++;
            categorySpending[p.category.name].total += Number(p.price) * p.quantity;

            // Merchant frequency
            if (p.merchant) {
              merchantFrequency[p.merchant] = (merchantFrequency[p.merchant] || 0) + 1;
            }

            // Brand preference
            if (p.brand) {
              brandPreference[p.brand] = (brandPreference[p.brand] || 0) + 1;
            }
          });

          // Top categories by spending
          const topCategories = Object.entries(categorySpending)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5)
            .map(([name, data]) => `  • ${name}: $${data.total.toFixed(2)} (${data.count} purchases)`)
            .join('\n');

          // Top merchants
          const topMerchants = Object.entries(merchantFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `  • ${name}: ${count} purchases`)
            .join('\n');

          // Top brands
          const topBrands = Object.entries(brandPreference)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `  • ${name}: ${count} purchases`)
            .join('\n');

          const totalSpent = Object.values(categorySpending).reduce((sum, data) => sum + data.total, 0);
          const avgPurchase = purchases.length > 0 ? totalSpent / purchases.length : 0;

          return {
            content: [{
              type: 'text',
              text: `📊 Shopping Profile Insights:\n\n` +
                    `📈 Purchase Statistics:\n` +
                    `  • Total Purchases: ${purchases.length}\n` +
                    `  • Total Spent: $${totalSpent.toFixed(2)}\n` +
                    `  • Average Purchase: $${avgPurchase.toFixed(2)}\n\n` +
                    `🏆 Top Categories by Spending:\n${topCategories || '  None yet'}\n\n` +
                    `🏪 Most Frequent Merchants:\n${topMerchants || '  None yet'}\n\n` +
                    `🏷️ Preferred Brands:\n${topBrands || '  None yet'}\n\n` +
                    `⚙️ Profile Settings:\n` +
                    `  • Deal Vote Minimum: ${profile.dealVoteMinimum}\n` +
                    `  • Last Analyzed: ${profile.lastAnalyzed.toISOString()}`
            }]
          };
        } catch (error) {
          console.error('Error in shopping_get_profile:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Update shopping profile settings
    server.tool(
      'shopping_update_profile',
      'Update shopping profile preferences',
      {
        dealVoteMinimum: z.number().int().min(0).optional().describe('Minimum votes for deals to consider'),
        preferredMerchants: z.array(z.string()).optional().describe('List of preferred merchants'),
        avoidedMerchants: z.array(z.string()).optional().describe('List of merchants to avoid'),
        preferredBrands: z.array(z.string()).optional().describe('List of preferred brands'),
      },
      async (params) => {
        try {
          const updateData: any = {};

          if (params.dealVoteMinimum !== undefined) {
            updateData.dealVoteMinimum = params.dealVoteMinimum;
          }
          if (params.preferredMerchants) {
            updateData.preferredMerchants = JSON.stringify(params.preferredMerchants);
          }
          if (params.avoidedMerchants) {
            updateData.avoidedMerchants = JSON.stringify(params.avoidedMerchants);
          }
          if (params.preferredBrands) {
            updateData.preferredBrands = JSON.stringify(params.preferredBrands);
          }

          const profile = await prisma.shoppingProfile.upsert({
            where: { profileName: 'default' },
            update: updateData,
            create: {
              profileName: 'default',
              ...updateData
            }
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Shopping profile updated!\n\n` +
                    `Settings:\n` +
                    `  • Deal Vote Minimum: ${profile.dealVoteMinimum}` +
                    (profile.preferredMerchants ? `\n  • Preferred Merchants: ${JSON.parse(profile.preferredMerchants).join(', ')}` : '') +
                    (profile.avoidedMerchants ? `\n  • Avoided Merchants: ${JSON.parse(profile.avoidedMerchants).join(', ')}` : '') +
                    (profile.preferredBrands ? `\n  • Preferred Brands: ${JSON.parse(profile.preferredBrands).join(', ')}` : '')
            }]
          };
        } catch (error) {
          console.error('Error in shopping_update_profile:', error);
          return {
            content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );
  },
  {},
  {
    basePath: '/api'
  },
);

// Wrap handler with MCP authentication
async function authenticatedHandler(req: Request) {
  const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';

  // Extract bearer token from Authorization header
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Missing bearer token' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
      },
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Validate the OAuth access token against the database
    const accessToken = await prisma.oauthAccessToken.findUnique({
      where: { accessToken: token },
    });

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        },
      });
    }

    // Check if token is expired
    if (accessToken.accessTokenExpiresAt && accessToken.accessTokenExpiresAt < new Date()) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Token expired' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        },
      });
    }

    // User is authenticated, proceed with the MCP handler
    return handler(req);
  } catch (error) {
    console.error('Auth validation error:', error);
    return new Response(JSON.stringify({ error: 'Unauthorized - Auth error' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
      },
    });
  }
}

export { authenticatedHandler as GET, authenticatedHandler as POST, authenticatedHandler as DELETE };