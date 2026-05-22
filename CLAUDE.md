# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

A personal Next.js (App Router) MCP server, deployed on Vercel. Exposes a set of tool modules at `/api/mcp` to authenticated MCP clients (Claude Desktop, Claude Web, Cursor, etc.). Authentication is OAuth 2.0 with Dynamic Client Registration via [Better Auth](https://better-auth.com)'s MCP plugin; user data lives in Vercel Postgres (Prisma) with Upstash Redis as a cache.

The set of registered tool modules is curated for the owner's personal use — feel free to disable/swap modules as priorities shift (see "Disabling a tool module" below).

## Development commands

- `npm run dev` — Next.js dev server with Turbopack (`http://localhost:3000`)
- `npm run build` — `prisma generate && next build`. Requires `DATABASE_URL` in the environment (copy `.env.local` from the running prod deploy or use the values from `.env.example`).
- `npm run start` — production server
- `npm run lint` — `next lint` (note: currently broken locally with "Invalid project directory"; use `npx eslint <file>` for spot checks)
- `npx vitest` — run the Vitest suite

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── mcp/route.ts              # MCP HTTP entrypoint + auth wrapper
│   │   ├── mcp/tools/<feature>.ts    # One tool module per feature
│   │   ├── auth/[...all]/route.ts    # Better Auth catch-all
│   │   └── freelancer/{callback,status,disconnect}/  # OAuth handshake for Freelancer.com
│   ├── .well-known/
│   │   ├── oauth-authorization-server/route.ts   # RFC 8414 metadata
│   │   └── oauth-protected-resource/route.ts     # RFC 9728 metadata
│   ├── mcp-login/page.tsx            # OAuth sign-in / sign-up page
│   └── mcp-tools/page.tsx            # Public docs page
├── lib/
│   ├── auth.ts                       # Better Auth config
│   ├── db.ts                         # Prisma singleton
│   ├── redis.ts                      # Upstash Redis client
│   ├── shared/                       # logger, cache, config, validation helpers
│   └── <feature>/                    # Feature-specific query/type modules
└── prisma/schema.prisma
```

### MCP server entrypoint

[`src/app/api/mcp/route.ts`](src/app/api/mcp/route.ts) builds the MCP handler via `createMcpHandler` from `@vercel/mcp-adapter`, then wraps it in an authentication shim that validates OAuth bearer tokens against the `OauthAccessToken` Prisma model. Expired access tokens are silently refreshed server-side when a valid refresh token is present.

Each feature is a separate registrar called inside the `createMcpHandler` callback:

```ts
import { registerHevyTools } from './tools/hevy';
// ...
const handler = createMcpHandler((server) => {
  registerDealsTools(server);
  registerHevyTools(server);
  // ...
}, {}, { basePath: '/api' });
```

### Tool module conventions

Each `src/app/api/mcp/tools/<feature>.ts` exports a single `register<Feature>Tools(server: McpServer)` function. Inside, register one or more tools:

```ts
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerWidgetTools(server: McpServer) {
  server.tool(
    'widget_search',
    'Search for widgets by query string.',
    {
      query: z.string().describe('What to search for'),
      limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
    },
    async ({ query, limit }) => {
      try {
        // ... do work ...
        return { content: [{ type: 'text' as const, text: 'result' }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text' as const, text: `Failed: ${message}` }] };
      }
    },
  );
}
```

Conventions to follow:
- Tool names are `snake_case`. Prefix with the feature domain (`hevy_*`, `budget_*`, `shopping_*`) to keep the global namespace clean.
- Every Zod field gets a `.describe(...)`. Clients show these descriptions to the LLM.
- Return shape is always `{ content: [{ type: 'text' as const, text: string }] }`. The `as const` matters for type narrowing.
- Catch all errors and return them as text — don't throw. Throws propagate as protocol errors and are harder to debug from the client side.
- Secrets read from `process.env` go inside the handler (not at module scope) so a missing env var produces a clear runtime error rather than crashing the route at boot.

### Disabling a tool module

To disable a feature without deleting code (the established pattern, from commit `7032d0a`):

1. Keep the `import { registerXxxTools } from './tools/xxx';` line at the top of `route.ts`.
2. Comment out the `registerXxxTools(server);` call inside the handler.

Lint will flag the unused import — that's expected and consistent with the existing pattern. Currently disabled: `fitness`, `trip`.

## OAuth flow

The auth dance is touchy; read this before changing anything in `src/app/mcp-login/` or `src/lib/auth.ts`.

1. **Discovery** — Client fetches `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. The latter points authorization, token, and registration endpoints at `/api/auth/mcp/*` (Better Auth MCP plugin).
2. **Dynamic Client Registration** — Client POSTs `/api/auth/mcp/register` to get a `client_id` and registered `redirect_uri`.
3. **Authorize** — Client navigates the user's browser to `/api/auth/mcp/authorize?response_type=code&client_id=...&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256`.
4. **Login bounce** — If no session cookie, Better Auth saves the original query in a signed `oidc_login_prompt` cookie and 302s to `/mcp-login?<original-query>` with the full OAuth query string preserved.
5. **Sign-in** — User submits the form. Page does `fetch('/api/auth/sign-in/email')` with `{email, password}`. Better Auth validates, sets a session cookie.
6. **Authorize re-entry** — On sign-in success, the login page does `window.location.href = '/api/auth/mcp/authorize' + window.location.search` (the original query preserved from step 4). **This step is critical.** Better Auth now has a session, validates the client_id, mints an authorization code, and 302s the browser to `redirect_uri?code=...&state=...`.
7. **Token exchange** — Client POSTs the code to `/api/auth/mcp/token` to receive an access token and refresh token.
8. **Authenticated MCP calls** — Client calls `/api/mcp` with `Authorization: Bearer <access_token>`. The route's auth wrapper validates the token, refreshes if expired, and forwards to the MCP handler.

### OAuth pitfall to avoid

**Do not navigate the user directly to `redirect_uri` from the login page.** That URL is the OAuth client's callback — it only works with a freshly-minted `?code=...` query attached. Navigating there from the login page (which has no code) causes Claude to error with `"code: Field required"`.

There's also a Better Auth quirk: the MCP plugin has a global `after` hook ([`plugins-BU90BfUc.mjs:2098`](node_modules/better-auth/dist/plugins-BU90BfUc.mjs:2098)) that tries to auto-complete the OAuth flow on any request that sets a session cookie while the `oidc_login_prompt` cookie is present. It uses `ctx.query.client_id` from the *current* request's URL — and since `/api/auth/sign-in/email` is called with no query string, that lookup fails and the hook 302s to `/api/auth/error?error=invalid_client`. The login page's `fetch()` silently follows that redirect chain to `/`; the page then proceeds with its own redirect to authorize. This produces harmless noise in the Vercel logs but does not affect the flow. Don't try to "fix" the after-hook error by passing OAuth params on the sign-in URL — that would 302 the fetch cross-origin to the OAuth client, which has its own failure modes.

## Database

Schema is in [`prisma/schema.prisma`](prisma/schema.prisma) — Vercel Postgres via Prisma. After editing the schema:

```bash
npx prisma migrate dev --name <descriptive_name>   # local
npx prisma generate                                # regenerate client (also runs on `npm run build`)
```

Better Auth's tables (user, session, account, verification, oauthApplication, oauthAccessToken, oauthConsent) live alongside feature tables.

## Environment variables

See [`.env.example`](.env.example) for the full list. Required:

- `DATABASE_URL`, `DATABASE_URL_UNPOOLED` — Vercel Postgres
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
- `BETTER_AUTH_URL` — full origin of the deployment (`https://mcp-tools-one.vercel.app` currently). Used as `trustedOrigins` for CSRF protection and as the `issuer` in OAuth metadata. **Must match the actual host the user reaches**, or sign-in will fail.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Upstash KV
- `HEVY_API_KEY` — Hevy Pro API key (Settings → API in the Hevy app); required for `hevy_*` tools
- `FREELANCER_CLIENT_ID`, `FREELANCER_CLIENT_SECRET`, `FREELANCER_REDIRECT_URI` — for the Freelancer integration in `freelancer.ts`
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI` — for the Strava integration. Register an app at https://www.strava.com/settings/api. Redirect URI must match exactly, e.g. `https://mcp-tools-one.vercel.app/api/strava/callback`. First-time setup: visit `/api/strava/connect` in a browser to authorize; tokens (access + refresh) are stored in Redis under `strava_token` and auto-refreshed by `getValidAccessToken()` in `src/lib/strava.ts`.
- `VAULT_OPS_API_KEY` — bearer token for the `/vault-ops/strava/activities` proxy (consumed by the `vault-ops` repo's daily roll-up). Generate with `openssl rand -hex 32`; same value goes in this project's Vercel env and in `vault-ops/.env`.

## Testing the MCP server locally

```bash
npm run dev
# Then either:
npx @modelcontextprotocol/inspector@latest http://localhost:3000/api/mcp
# Or point Claude Desktop / Claude Web at the local URL via the MCP connector UI.
```

The auth flow works against `localhost` provided `BETTER_AUTH_URL=http://localhost:3000` is set.

## Deployment

Auto-deploys to Vercel from `main`. `vercel.json` extends the `/api/mcp` route timeout to 60 seconds (default is 10).

When adding env vars, set them in the Vercel project (Settings → Environment Variables) for both Production and Preview; the worktree's `.env.local` is for local dev only and never committed.

## Key dependencies

- `@vercel/mcp-adapter` — MCP server adapter for Next.js
- `@modelcontextprotocol/sdk` — MCP types and `McpServer`
- `better-auth` + `better-auth/plugins/mcp` — OAuth provider with DCR
- `@prisma/client` / `prisma` — Postgres ORM
- `@upstash/redis` — cache
- `zod` — tool parameter validation
- `pino` — structured logging (`src/lib/shared/logger.ts`)
- `vitest` — tests
