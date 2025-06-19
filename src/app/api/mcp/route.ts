import { z } from 'zod';
import { createMcpHandler } from '@vercel/mcp-adapter';

const handler = createMcpHandler(
  (server) => {
    // Example tool: Roll a dice
    server.tool(
      'roll_dice',
      'Rolls an N-sided die and returns the result',
      { 
        sides: z.number().int().min(2).max(100).describe('Number of sides on the die (2-100)')
      },
      async ({ sides }) => {
        const value = 1 + Math.floor(Math.random() * sides);
        return {
          content: [{ 
            type: 'text', 
            text: `🎲 You rolled a ${value} on a ${sides}-sided die!` 
          }],
        };
      },
    );

    // Example tool: Generate random password
    server.tool(
      'generate_password',
      'Generates a secure random password',
      {
        length: z.number().int().min(8).max(128).default(16).describe('Password length (8-128 characters)'),
        includeSymbols: z.boolean().default(true).describe('Include special symbols in password')
      },
      async ({ length, includeSymbols }) => {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        let charset = lowercase + uppercase + numbers;
        if (includeSymbols) {
          charset += symbols;
        }
        
        let password = '';
        for (let i = 0; i < length; i++) {
          password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        return {
          content: [{ 
            type: 'text', 
            text: `🔐 Generated password: ${password}` 
          }],
        };
      },
    );

    // Example tool: Get current timestamp
    server.tool(
      'current_timestamp',
      'Returns the current Unix timestamp and formatted date',
      {},
      async () => {
        const now = new Date();
        const timestamp = Math.floor(now.getTime() / 1000);
        const formatted = now.toISOString();
        
        return {
          content: [{ 
            type: 'text', 
            text: `⏰ Current timestamp: ${timestamp}\nFormatted: ${formatted}` 
          }],
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