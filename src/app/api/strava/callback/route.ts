import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, setStoredTokens } from '@/lib/strava';

function htmlResponse(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Strava</title>` +
      `<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:4rem auto;padding:0 1rem;line-height:1.5}` +
      `code{background:#f3f4f6;padding:.1rem .3rem;border-radius:.25rem}</style></head><body>${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html' } },
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const scope = searchParams.get('scope') ?? '';

  if (error) {
    return htmlResponse(`<h1>Strava authorization failed</h1><p>Strava returned: <code>${error}</code></p>`, 400);
  }
  if (!code) {
    return htmlResponse('<h1>Missing authorization code</h1>', 400);
  }

  const requiredScopes = ['read', 'activity:read_all', 'profile:read_all'];
  const grantedScopes = scope.split(',').map((s) => s.trim()).filter(Boolean);
  const missingScopes = requiredScopes.filter((s) => !grantedScopes.includes(s));

  try {
    const tokens = await exchangeCodeForToken(code);
    await setStoredTokens(tokens);

    const warning = missingScopes.length
      ? `<p style="color:#b45309">Note: some scopes were not granted: <code>${missingScopes.join(', ')}</code>. Some tools may return limited data.</p>`
      : '';

    return htmlResponse(
      `<h1>Strava connected</h1>` +
        `<p>Connected as <strong>${tokens.athlete_username ?? 'athlete'}</strong> (id ${tokens.athlete_id ?? '?'}).</p>` +
        warning +
        `<p>You can close this tab.</p>`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return htmlResponse(`<h1>Token exchange failed</h1><p><code>${message}</code></p>`, 500);
  }
}
