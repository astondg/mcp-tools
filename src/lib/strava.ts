import redis from './redis';

export const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
export const STRAVA_AUTH_BASE = 'https://www.strava.com/oauth';
const TOKEN_KEY = 'strava_token';
const REFRESH_SKEW_SECONDS = 60;

export type StravaTokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete_id?: number;
  athlete_username?: string;
};

type RawTokenResponse = {
  token_type?: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in?: number;
  athlete?: { id?: number; username?: string };
};

function getStravaConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Strava OAuth credentials. Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_REDIRECT_URI.',
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export async function getStoredTokens(): Promise<StravaTokenBundle | null> {
  const value = await redis.get<StravaTokenBundle | string>(TOKEN_KEY);
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as StravaTokenBundle;
    } catch {
      return null;
    }
  }
  return value;
}

export async function setStoredTokens(tokens: StravaTokenBundle): Promise<void> {
  await redis.set(TOKEN_KEY, tokens);
}

export async function clearStoredTokens(): Promise<void> {
  await redis.del(TOKEN_KEY);
}

export async function isStravaConnected(): Promise<boolean> {
  return (await getStoredTokens()) !== null;
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenBundle> {
  const { clientId, clientSecret } = getStravaConfig();
  const response = await fetch(`${STRAVA_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Strava token exchange failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as RawTokenResponse;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete?.id,
    athlete_username: data.athlete?.username,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<RawTokenResponse> {
  const { clientId, clientSecret } = getStravaConfig();
  const response = await fetch(`${STRAVA_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Strava token refresh failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as RawTokenResponse;
}

export async function getValidAccessToken(): Promise<string | null> {
  const bundle = await getStoredTokens();
  if (!bundle) return null;

  const now = Math.floor(Date.now() / 1000);
  if (bundle.expires_at - now > REFRESH_SKEW_SECONDS) {
    return bundle.access_token;
  }

  const refreshed = await refreshAccessToken(bundle.refresh_token);
  const updated: StravaTokenBundle = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
    athlete_id: bundle.athlete_id,
    athlete_username: bundle.athlete_username,
  };
  await setStoredTokens(updated);
  return updated.access_token;
}

export async function getAthleteIdFromStorage(): Promise<number | null> {
  const bundle = await getStoredTokens();
  return bundle?.athlete_id ?? null;
}

export async function stravaFetch<T = unknown>(
  path: string,
  init?: { method?: string; query?: Record<string, string | number | boolean | undefined>; body?: unknown },
): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not connected to Strava. Visit /api/strava/connect to authorize.');
  }

  const url = new URL(`${STRAVA_API_BASE}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url.toString(), {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Strava API ${response.status} ${response.statusText}: ${errorText || '(no body)'}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export function buildAuthorizeUrl(state?: string): string {
  const { clientId, redirectUri } = getStravaConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'auto',
    scope: 'read,activity:read_all,profile:read_all',
  });
  if (state) params.set('state', state);
  return `${STRAVA_AUTH_BASE}/authorize?${params.toString()}`;
}
