# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application that serves as an MCP (Model Context Protocol) tools server. It provides utility tools that can be accessed by MCP-compatible clients like Claude Desktop and Cursor through HTTP requests to the `/api/mcp` endpoint.

## Development Commands

- `npm run dev` - Start development server with Turbopack (runs on http://localhost:3000)
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint to check code quality

## Architecture

### MCP Server Implementation
The core MCP server is implemented in `src/app/api/mcp/route.ts` using the `@vercel/mcp-adapter` package. This file:
- Uses `createMcpHandler()` to create the MCP server
- Defines tools using `server.tool()` with Zod schema validation
- Exports HTTP handlers (GET, POST, DELETE) for Next.js API routes
- Configured with `basePath: '/api'` for proper routing

### Tool Structure
Each MCP tool follows this pattern:
```typescript
server.tool(
  'tool_name',           // Tool identifier
  'Tool description',    // Human-readable description
  { /* Zod schema */ },  // Parameter validation schema
  async ({ params }) => { // Tool implementation
    return {
      content: [{ type: 'text', text: 'result' }]
    };
  }
);
```

### Current Tools
- `roll_dice` - Rolls N-sided die (2-100 sides)
- `generate_password` - Creates secure passwords (8-128 chars, optional symbols)
- `current_timestamp` - Returns Unix timestamp and ISO formatted date

## Key Dependencies

- `@vercel/mcp-adapter` - Vercel's MCP server adapter for Next.js
- `zod` - Schema validation for tool parameters
- `next` - React framework with App Router
- `tailwindcss` - Styling framework

## Deployment Configuration

### Vercel Settings
- `vercel.json` configures the MCP route with 60-second timeout
- Optimized for Vercel's serverless functions
- Uses Next.js App Router API routes

### Testing the MCP Server
- Local endpoint: `http://localhost:3000/api/mcp`
- Test with MCP Inspector: `npx @modelcontextprotocol/inspector@latest <endpoint-url>`
- Verify build passes before deployment with `npm run build`

## Adding New Tools

1. Edit `src/app/api/mcp/route.ts`
2. Add new `server.tool()` call within the `createMcpHandler` callback
3. Define Zod schema for parameters with `.describe()` for documentation
4. Implement async handler function returning `{ content: [{ type: 'text', text: 'result' }] }`
5. Update homepage (`src/app/page.tsx`) to document the new tool
6. Test locally before deployment