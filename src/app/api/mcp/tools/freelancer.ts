import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenStorage } from '@/lib/redis';

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

export function registerFreelancerTools(server: McpServer) {
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
              type: 'text' as const,
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
              type: 'text' as const,
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
            type: 'text' as const,
            text: `✅ Found ${projects.length} project(s) matching "${query}"${budgetFilter}${typeFilter}:\n\n${projectsList}\n\n🔗 Search performed using Freelancer.com API`
          }]
        };

      } catch (error) {
        console.error('Error in search_freelancer_projects:', error);
        return {
          content: [{
            type: 'text' as const,
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
              type: 'text' as const,
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
            type: 'text' as const,
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
            type: 'text' as const,
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
              type: 'text' as const,
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
            type: 'text' as const,
            text: response
          }]
        };

      } catch (error) {
        console.error('Error in get_freelancer_project_details:', error);
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Error getting project details: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease check the project ID and try again.`
          }]
        };
      }
    },
  );
}
