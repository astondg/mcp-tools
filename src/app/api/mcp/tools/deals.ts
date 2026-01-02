import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import prisma from '@/lib/db';

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

export function registerDealsTools(server: McpServer) {
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
            text: `Found ${formatted.length} deals from OzBargain:\n\n${JSON.stringify(formatted, null, 2)}`
          }]
        };
      } catch (error) {
        console.error('Error fetching OzBargain deals:', error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
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
              text: `No deals found matching "${params.keywords}"${params.maxPrice ? ` under $${params.maxPrice}` : ''}`
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
            text: `Found ${formatted.length} matching deals:\n\n${JSON.stringify(formatted, null, 2)}`
          }]
        };
      } catch (error) {
        console.error('Error searching OzBargain:', error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
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
              text: `No deals found matching your profile.\n\n` +
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
            text: `Found ${formatted.length} personalized deals for you:\n\n${JSON.stringify(formatted, null, 2)}\n\n` +
                  `Deals are ranked by relevance to your wishlist, purchase history, and preferences.`
          }]
        };
      } catch (error) {
        console.error('Error finding matching deals:', error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}
