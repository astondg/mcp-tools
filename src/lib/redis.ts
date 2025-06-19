import { Redis } from '@upstash/redis';

// Initialize Redis client
// Vercel will provide these environment variables when you add Upstash Redis integration
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default redis;

// Helper functions for token management
export const TokenStorage = {
  // Store the user's Freelancer OAuth token
  async setFreelancerToken(token: string): Promise<void> {
    await redis.set('freelancer_token', token);
  },

  // Retrieve the user's Freelancer OAuth token
  // If FREELANCER_TEST_TOKEN is set, use that for testing (while app is pending review)
  async getFreelancerToken(): Promise<string | null> {
    // Check for testing override first
    const testToken = process.env.FREELANCER_TEST_TOKEN;
    if (testToken) {
      return testToken;
    }
    
    // Otherwise use stored OAuth token
    return await redis.get('freelancer_token');
  },

  // Check if user is authenticated (either OAuth token or test token)
  async isAuthenticated(): Promise<boolean> {
    // If test token is configured, always consider authenticated
    if (process.env.FREELANCER_TEST_TOKEN) {
      return true;
    }
    
    // Otherwise check stored token
    const token = await redis.get('freelancer_token');
    return token !== null;
  },

  // Clear the token (logout) - but test token persists
  async clearToken(): Promise<void> {
    await redis.del('freelancer_token');
  }
};