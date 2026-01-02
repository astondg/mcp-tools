import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type ToolRegistrar = (server: McpServer) => void;
