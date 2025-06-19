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
  async getFreelancerToken(): Promise<string | null> {
    return await redis.get('freelancer_token');
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const token = await redis.get('freelancer_token');
    return token !== null;
  },

  // Clear the token (logout)
  async clearToken(): Promise<void> {
    await redis.del('freelancer_token');
  }
};