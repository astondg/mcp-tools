# MCP Tools Server

A Next.js application that provides a collection of useful tools via the Model Context Protocol (MCP), hosted on Vercel.

## What is MCP?

The Model Context Protocol (MCP) allows AI assistants like Claude to connect to external tools and data sources. This server provides tools that can be called by MCP-compatible clients.

## Available Tools

### 🎲 Roll Dice
- **Function**: `roll_dice`
- **Description**: Rolls an N-sided die and returns the result
- **Parameters**: 
  - `sides` (number): Number of sides on the die (2-100)

### 🔐 Generate Password
- **Function**: `generate_password`
- **Description**: Generates a secure random password
- **Parameters**:
  - `length` (number, default: 16): Password length (8-128 characters)
  - `includeSymbols` (boolean, default: true): Include special symbols

### ⏰ Current Timestamp
- **Function**: `current_timestamp`
- **Description**: Returns the current Unix timestamp and formatted date
- **Parameters**: None

## Setup & Deployment

### Local Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. The MCP server will be available at `http://localhost:3000/api/mcp`

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/mcp-tools)

Or deploy manually:

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts to deploy

## Connecting to MCP Clients

### Using with Claude (Desktop)

1. Open Claude Desktop
2. Go to Settings → Developer
3. Add this MCP server configuration:
   ```json
   {
     "servers": {
       "mcp-tools": {
         "command": "node",
         "args": ["-e", "require('@modelcontextprotocol/server-http').createServer({ url: 'https://your-domain.vercel.app/api/mcp' })"]
       }
     }
   }
   ```

### Using with Cursor

1. Open Cursor settings
2. Add the MCP server URL: `https://your-domain.vercel.app/api/mcp`

## Testing

You can test the MCP server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest https://your-domain.vercel.app/api/mcp
```

## Project Structure

```
├── src/
│   └── app/
│       ├── api/
│       │   └── mcp/
│       │       └── route.ts      # MCP server implementation
│       ├── page.tsx              # Homepage with tool documentation
│       └── layout.tsx            # App layout
├── vercel.json                   # Vercel configuration
└── package.json                  # Dependencies and scripts
```

## Adding New Tools

To add a new tool, edit `src/app/api/mcp/route.ts`:

```typescript
server.tool(
  'your_tool_name',
  'Description of what your tool does',
  { 
    // Define parameters using Zod schema
    param1: z.string().describe('Parameter description')
  },
  async ({ param1 }) => {
    // Tool implementation
    return {
      content: [{ 
        type: 'text', 
        text: 'Tool result' 
      }],
    };
  },
);
```

## Built With

- [Next.js](https://nextjs.org/) - React framework
- [@vercel/mcp-adapter](https://vercel.com/docs/mcp) - Vercel's MCP adapter
- [Zod](https://zod.dev/) - Schema validation
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Vercel](https://vercel.com/) - Hosting platform

## License

MIT
