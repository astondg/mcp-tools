import { createMcpHandler } from '@vercel/mcp-adapter';
import { prisma } from '@/lib/db';

// Import tool registrars
import { registerDealsTools } from './tools/deals';
import { registerShoppingTools } from './tools/shopping';
import { registerFreelancerTools } from './tools/freelancer';
import { registerJobsTools } from './tools/jobs';
import { registerVehicleTools } from './tools/vehicle';
import { registerBudgetTools } from './tools/budget';
import { registerFitnessTools } from './tools/fitness';
import { registerScenarioTools } from './tools/scenarios';
import { registerCategorizationTools } from './tools/categorization';
import { registerTripTools } from './tools/trip';

const handler = createMcpHandler(
  (server) => {
    // Register all tool modules
    registerDealsTools(server);
    registerShoppingTools(server);
    registerFreelancerTools(server);
    registerJobsTools(server);
    registerVehicleTools(server);
    registerBudgetTools(server);
    registerFitnessTools(server);
    registerScenarioTools(server);
    registerCategorizationTools(server);
    registerTripTools(server);
  },
  {},
  {
    basePath: '/api'
  },
);

// Helper function to generate a secure random token
function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

// Token expiration settings (matching auth.ts config)
const ACCESS_TOKEN_EXPIRES_IN = 60 * 60 * 24; // 24 hours in seconds

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
    let accessToken = await prisma.oauthAccessToken.findUnique({
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

    // Check if access token is expired
    if (accessToken.accessTokenExpiresAt && accessToken.accessTokenExpiresAt < new Date()) {
      // Check if we have a valid refresh token to use
      if (
        accessToken.refreshToken &&
        accessToken.refreshTokenExpiresAt &&
        accessToken.refreshTokenExpiresAt > new Date()
      ) {
        // Refresh the access token
        const newAccessToken = generateSecureToken(64);
        const newExpiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRES_IN * 1000);

        try {
          accessToken = await prisma.oauthAccessToken.update({
            where: { id: accessToken.id },
            data: {
              accessToken: newAccessToken,
              accessTokenExpiresAt: newExpiresAt,
              updatedAt: new Date(),
            },
          });

          console.log(`[MCP Auth] Refreshed expired access token for user ${accessToken.userId}`);

          // Note: The client still has the old token, but we've refreshed it server-side.
          // The request will proceed, but future requests will need the new token.
          // For MCP clients that don't support token refresh responses, we proceed with the request.
        } catch (refreshError) {
          console.error('[MCP Auth] Failed to refresh token:', refreshError);
          return new Response(JSON.stringify({ error: 'Unauthorized - Token refresh failed' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
            },
          });
        }
      } else {
        // No valid refresh token, require re-authentication
        console.log(`[MCP Auth] Access token expired and no valid refresh token for user ${accessToken.userId}`);
        return new Response(JSON.stringify({ error: 'Unauthorized - Token expired, please re-authenticate' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
          },
        });
      }
    }

    // User is authenticated, proceed with the MCP handler
    return handler(req);
  } catch (error) {
    console.error('[MCP Auth] Auth validation error:', error);
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
