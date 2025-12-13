import { z } from 'zod';
import { createMcpHandler } from '@vercel/mcp-adapter';
import { TokenStorage } from '@/lib/redis';
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
} from '@/lib/budget/queries';
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
    // OzBargain deals RSS feed tool
    server.tool(
      'get_ozbargain_deals',
      'Fetch and parse the latest deals from OzBargain RSS feed',
      {
        limit: z.number().int().min(1).max(50).default(10).describe('Number of deals to return (1-50)')
      },
      async ({ limit }) => {
        try {
          const response = await fetch('https://www.ozbargain.com.au/deals/feed', {
            headers: {
              'User-Agent': 'MCP-Tools RSS Reader/1.0'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const xmlText = await response.text();
          
          // Parse XML using DOMParser (available in Node.js environments with proper polyfill)
          // For now, we'll use regex parsing for simplicity
          const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);
          
          if (!itemMatches) {
            return {
              content: [{
                type: 'text',
                text: 'No deals found in the RSS feed.'
              }]
            };
          }

          const deals = itemMatches.slice(0, limit).map((item, index) => {
            // Extract title (handle both CDATA and plain text)
            let titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
            let title = '';
            if (titleMatch) {
              title = titleMatch[1];
            } else {
              titleMatch = item.match(/<title>(.*?)<\/title>/);
              title = titleMatch ? titleMatch[1] : '';
            }

            // Extract link
            const linkMatch = item.match(/<link>(.*?)<\/link>/);
            const link = linkMatch ? linkMatch[1] : '';

            // Extract description and clean CDATA
            const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
            let description = '';
            if (descMatch) {
              // Remove HTML tags and extract text content
              description = descMatch[1]
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/&[^;]+;/g, ' ') // Remove HTML entities
                .trim()
                .substring(0, 200); // Limit to 200 chars
              if (description.length === 200) description += '...';
            }

            // Extract media thumbnail
            const thumbnailMatch = item.match(/<media:thumbnail url="([^"]*?)"/);
            const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;

            // Extract categories
            const categoryMatches = item.match(/<category[^>]*?>(.*?)<\/category>/g);
            const categories = categoryMatches ? 
              categoryMatches.map(cat => cat.replace(/<[^>]*>/g, '').trim()) : [];

            // Extract publish date
            const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
            const pubDate = pubDateMatch ? pubDateMatch[1] : '';

            return {
              index: index + 1,
              title,
              link,
              description,
              thumbnail,
              categories,
              pubDate
            };
          });

          // Format as JSON string for clean output
          const formattedDeals = deals.map(deal => ({
            title: deal.title,
            link: deal.link,
            description: deal.description,
            thumbnail: deal.thumbnail,
            categories: deal.categories,
            pubDate: deal.pubDate
          }));

          return {
            content: [{
              type: 'text',
              text: `📦 Found ${deals.length} deals from OzBargain:\n\n${JSON.stringify(formattedDeals, null, 2)}`
            }]
          };

        } catch (error) {
          console.error('Error fetching OzBargain deals:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error fetching OzBargain deals: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
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
        cost: z.number().min(0).optional().describe('Total cost of service'),
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
            (record.cost ? `• Cost: $${record.cost.toFixed(2)}\n` : '') +
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
      'Get service history for vehicles, with optional filters',
      {
        vehicleId: z.string().uuid().optional().describe('Filter by vehicle ID'),
        serviceType: z.string().optional().describe('Filter by service type'),
        startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
        includeParts: z.boolean().optional().describe('Include parts details (default: true)'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
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
          });

          if (records.length === 0) {
            return {
              content: [{ type: 'text', text: 'No service records found matching your criteria.' }]
            };
          }

          const recordList = records.map(r => {
            let entry = `• **${r.serviceType}** on ${r.serviceDate.toISOString().split('T')[0]}\n` +
              `  Vehicle: ${r.vehicleName}\n` +
              (r.odometer ? `  Odometer: ${r.odometer.toLocaleString()} km\n` : '') +
              (r.cost ? `  Cost: $${r.cost.toFixed(2)}\n` : '') +
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
        cost: z.number().min(0).optional().describe('New cost'),
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
        category: z.string().optional().describe('Category name (auto-categorizes if not provided)'),
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
      'Bulk import expenses from CSV data with auto-categorization',
      {
        csvData: z.string().min(1).describe('Raw CSV data as a string'),
        dateColumn: z.string().describe('Name of the date column'),
        amountColumn: z.string().describe('Name of the amount column'),
        descriptionColumn: z.string().describe('Name of the description column'),
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
      'Query expenses with filters for date range, category, amount, etc.',
      {
        startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
        category: z.string().optional().describe('Filter by category name'),
        minAmount: z.number().optional().describe('Minimum amount'),
        maxAmount: z.number().optional().describe('Maximum amount'),
        source: z.enum(['MANUAL', 'BANK_IMPORT']).optional().describe('Filter by source'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
      },
      async (params) => {
        try {
          const expenses = await getExpenses({
            startDate: params.startDate ? new Date(params.startDate) : undefined,
            endDate: params.endDate ? new Date(params.endDate) : undefined,
            categoryName: params.category,
            minAmount: params.minAmount,
            maxAmount: params.maxAmount,
            source: params.source,
            limit: params.limit,
          });

          if (expenses.length === 0) {
            return {
              content: [{ type: 'text', text: 'No expenses found matching your criteria.' }]
            };
          }

          const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
          const expenseList = expenses.map(exp =>
            `• **${exp.date.toISOString().split('T')[0]}** - $${exp.amount.toFixed(2)}\n` +
            `  Category: ${exp.categoryName}\n` +
            `  ${exp.description}` +
            (exp.merchantName ? ` (${exp.merchantName})` : '')
          ).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `💸 Expenses (${expenses.length} items, Total: $${total.toFixed(2)}):\n\n${expenseList}`
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
  },
  {},
  {
    basePath: '/api'
  },
);

export { handler as GET, handler as POST, handler as DELETE };