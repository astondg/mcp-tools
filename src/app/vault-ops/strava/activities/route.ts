import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { getStoredTokens, getValidAccessToken, STRAVA_API_BASE } from '@/lib/strava';
import { logger } from '@/lib/shared/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_WINDOW_SECONDS = 35 * 24 * 60 * 60;
const PER_PAGE = 50;
const MAX_PAGES = 5;

type StravaActivity = {
  id: number;
  type: string;
  start_date_local: string;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  has_heartrate: boolean;
  average_heartrate: number | null;
  max_heartrate: number | null;
  suffer_score: number | null;
  average_speed: number;
  workout_type: number | null;
  average_watts: number | null;
  weighted_average_watts: number | null;
  kilojoules: number | null;
};

function errorJson(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function checkBearer(authHeader: string | null): boolean {
  const expected = process.env.VAULT_OPS_API_KEY;
  if (!expected) return false;

  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  // Hash both sides to equal-length buffers so timingSafeEqual is well-defined
  // regardless of provided length, and to avoid leaking length info.
  const expectedHash = createHash('sha256').update(expected).digest();
  const providedHash = createHash('sha256').update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

function parseEpochParam(raw: string | null): number | null {
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function slimActivity(a: Record<string, unknown>): StravaActivity {
  return {
    id: a.id as number,
    type: a.type as string,
    start_date_local: a.start_date_local as string,
    name: a.name as string,
    distance: a.distance as number,
    moving_time: a.moving_time as number,
    elapsed_time: a.elapsed_time as number,
    total_elevation_gain: a.total_elevation_gain as number,
    has_heartrate: a.has_heartrate as boolean,
    average_heartrate: (a.average_heartrate as number | undefined) ?? null,
    max_heartrate: (a.max_heartrate as number | undefined) ?? null,
    suffer_score: (a.suffer_score as number | undefined) ?? null,
    average_speed: a.average_speed as number,
    workout_type: (a.workout_type as number | undefined) ?? null,
    average_watts: (a.average_watts as number | undefined) ?? null,
    weighted_average_watts: (a.weighted_average_watts as number | undefined) ?? null,
    kilojoules: (a.kilojoules as number | undefined) ?? null,
  };
}

export async function GET(req: NextRequest) {
  if (!checkBearer(req.headers.get('authorization'))) {
    return errorJson(401, 'unauthorized');
  }

  const sp = req.nextUrl.searchParams;
  const since = parseEpochParam(sp.get('since'));
  const until = parseEpochParam(sp.get('until'));
  if (since === null || until === null || until <= since) {
    return errorJson(400, 'missing or invalid since/until');
  }
  if (until - since > MAX_WINDOW_SECONDS) {
    return errorJson(400, 'window too wide (max 35 days)');
  }

  const stored = await getStoredTokens();
  if (!stored) {
    return errorJson(503, 'strava not configured');
  }

  let accessToken: string;
  try {
    const t = await getValidAccessToken();
    if (!t) return errorJson(503, 'strava not configured');
    accessToken = t;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'vault-ops: strava token refresh failed');
    return errorJson(502, 'upstream strava error');
  }

  const collected: StravaActivity[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
    url.searchParams.set('before', String(until));
    url.searchParams.set('after', String(since));
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));

    let resp: Response;
    try {
      resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err), page }, 'vault-ops: strava network error');
      return errorJson(502, 'upstream strava error');
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      logger.error({ status: resp.status, body: body.slice(0, 500), page }, 'vault-ops: strava api error');
      return errorJson(502, 'upstream strava error');
    }

    let batch: Record<string, unknown>[];
    try {
      batch = (await resp.json()) as Record<string, unknown>[];
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err), page }, 'vault-ops: strava json parse failed');
      return errorJson(502, 'upstream strava error');
    }

    if (!Array.isArray(batch)) {
      logger.error({ page }, 'vault-ops: strava returned non-array');
      return errorJson(502, 'upstream strava error');
    }

    for (const a of batch) collected.push(slimActivity(a));
    if (batch.length < PER_PAGE) break;
  }

  collected.sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
  return NextResponse.json(collected);
}
