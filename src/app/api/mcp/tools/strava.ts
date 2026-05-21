import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getStoredTokens, stravaFetch } from '@/lib/strava';

const CONNECT_PATH = '/api/strava/connect';

type Athlete = {
  id: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  premium?: boolean;
  created_at?: string;
  weight?: number;
  ftp?: number;
  measurement_preference?: string;
  bio?: string;
};

type SummaryActivity = {
  id: number;
  name: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  sport_type?: string;
  type?: string;
  start_date?: string;
  start_date_local?: string;
  timezone?: string;
  location_city?: string;
  location_country?: string;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  suffer_score?: number;
  kudos_count?: number;
  comment_count?: number;
  achievement_count?: number;
  pr_count?: number;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
};

type DetailedActivity = SummaryActivity & {
  description?: string;
  calories?: number;
  device_name?: string;
  gear_id?: string;
  splits_metric?: Array<{ split: number; distance: number; elapsed_time: number; average_speed: number; average_heartrate?: number }>;
  best_efforts?: Array<{ name: string; elapsed_time: number; distance: number; pr_rank?: number | null }>;
  segment_efforts?: Array<{ id: number; name: string; elapsed_time: number; distance: number; pr_rank?: number | null }>;
};

type AthleteStatsTotal = {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
};

type AthleteStats = {
  biggest_ride_distance?: number;
  biggest_climb_elevation_gain?: number;
  recent_ride_totals?: AthleteStatsTotal;
  recent_run_totals?: AthleteStatsTotal;
  recent_swim_totals?: AthleteStatsTotal;
  ytd_ride_totals?: AthleteStatsTotal;
  ytd_run_totals?: AthleteStatsTotal;
  ytd_swim_totals?: AthleteStatsTotal;
  all_ride_totals?: AthleteStatsTotal;
  all_run_totals?: AthleteStatsTotal;
  all_swim_totals?: AthleteStatsTotal;
};

type Zone = { min: number; max: number };
type AthleteZones = {
  heart_rate?: { custom_zones?: boolean; zones?: Zone[] };
  power?: { zones?: Zone[] };
};

type StreamData = {
  data?: Array<number | [number, number]>;
  series_type?: string;
  original_size?: number;
  resolution?: string;
};

type Route = {
  id: number;
  id_str?: string;
  name: string;
  description?: string;
  distance?: number;
  elevation_gain?: number;
  type?: number;
  sub_type?: number;
  estimated_moving_time?: number;
  created_at?: string;
  private?: boolean;
  starred?: boolean;
};

type Segment = {
  id: number;
  name: string;
  activity_type?: string;
  distance?: number;
  average_grade?: number;
  maximum_grade?: number;
  elevation_high?: number;
  elevation_low?: number;
  total_elevation_gain?: number;
  climb_category?: number;
  city?: string;
  state?: string;
  country?: string;
  private?: boolean;
  effort_count?: number;
  athlete_count?: number;
  star_count?: number;
};

type ExploreSegment = {
  id: number;
  name: string;
  climb_category?: number;
  climb_category_desc?: string;
  avg_grade?: number;
  distance?: number;
  elev_difference?: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  points?: string;
};

function textResponse(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResponse(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return textResponse(`${label}: ${message}`);
}

function notConnectedResponse() {
  const base = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  return textResponse(
    `🔒 Strava is not connected.\n\n` +
      `Open this URL in a browser to authorize:\n${base}${CONNECT_PATH}\n\n` +
      `After approving the Strava prompt, re-run the tool.`,
  );
}

async function requireAthleteId(): Promise<number> {
  const tokens = await getStoredTokens();
  if (!tokens?.athlete_id) {
    throw new Error('Athlete ID is not stored. Reconnect Strava via /api/strava/connect.');
  }
  return tokens.athlete_id;
}

function formatDistance(meters?: number): string {
  if (meters == null) return '?';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds?: number): string {
  if (seconds == null) return '?';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(metersPerSecond?: number): string {
  if (!metersPerSecond || metersPerSecond <= 0) return '?';
  const secondsPerKm = 1000 / metersPerSecond;
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function formatActivityLine(a: SummaryActivity): string {
  const date = a.start_date_local ?? a.start_date ?? '?';
  const sport = a.sport_type ?? a.type ?? 'Activity';
  const parts: string[] = [
    `• **${a.name}** (id: ${a.id})`,
    `${date} — ${sport}`,
    `${formatDistance(a.distance)}`,
    `${formatDuration(a.moving_time)}`,
  ];
  if (a.average_heartrate) parts.push(`avg HR ${Math.round(a.average_heartrate)}`);
  if (a.average_watts) parts.push(`avg ${Math.round(a.average_watts)}W`);
  if (a.total_elevation_gain) parts.push(`+${Math.round(a.total_elevation_gain)}m`);
  return parts.join(' · ');
}

function formatStatsTotal(label: string, totals?: AthleteStatsTotal): string | null {
  if (!totals || totals.count === 0) return null;
  return `${label}: ${totals.count} activities, ${formatDistance(totals.distance)}, ${formatDuration(totals.moving_time)}, +${Math.round(totals.elevation_gain)}m`;
}

function summarizeNumericStream(data: number[]): string {
  if (!data.length) return 'empty';
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const avg = sum / data.length;
  return `n=${data.length}, min=${min.toFixed(1)}, max=${max.toFixed(1)}, avg=${avg.toFixed(1)}`;
}

export function registerStravaTools(server: McpServer) {
  // ---------- Athlete + activities ----------

  server.tool(
    'strava_get_athlete',
    'Get the authenticated Strava athlete profile (name, location, premium status, FTP, weight).',
    {},
    async () => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();

        const a = await stravaFetch<Athlete>('/athlete');
        const lines = [
          `**${a.firstname ?? ''} ${a.lastname ?? ''}** (@${a.username ?? '?'}, id ${a.id})`,
          `Location: ${[a.city, a.state, a.country].filter(Boolean).join(', ') || '—'}`,
          `Premium: ${a.premium ? 'yes' : 'no'}`,
          `Measurement: ${a.measurement_preference ?? '?'}`,
        ];
        if (a.weight) lines.push(`Weight: ${a.weight} kg`);
        if (a.ftp) lines.push(`FTP: ${a.ftp} W`);
        if (a.bio) lines.push(`Bio: ${a.bio}`);
        return textResponse(lines.join('\n'));
      } catch (error) {
        return errorResponse('Failed to fetch athlete', error);
      }
    },
  );

  server.tool(
    'strava_list_activities',
    "List the authenticated athlete's activities, most recent first. Use `before`/`after` (ISO date or unix seconds) to filter by date range.",
    {
      before: z
        .string()
        .optional()
        .describe('Upper bound — ISO date (YYYY-MM-DD), ISO datetime, or unix epoch seconds. Activities before this time only.'),
      after: z
        .string()
        .optional()
        .describe('Lower bound — ISO date (YYYY-MM-DD), ISO datetime, or unix epoch seconds. Activities after this time only.'),
      page: z.number().int().min(1).default(1).describe('Page number (1-indexed)'),
      per_page: z.number().int().min(1).max(200).default(30).describe('Activities per page (max 200)'),
    },
    async ({ before, after, page, per_page }) => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();

        const toEpoch = (input?: string): number | undefined => {
          if (!input) return undefined;
          const trimmed = input.trim();
          if (/^\d+$/.test(trimmed)) return Number(trimmed);
          const parsed = Date.parse(trimmed);
          if (Number.isNaN(parsed)) throw new Error(`Could not parse date: ${input}`);
          return Math.floor(parsed / 1000);
        };

        const query: Record<string, string | number | undefined> = {
          page,
          per_page,
          before: toEpoch(before),
          after: toEpoch(after),
        };
        const activities = await stravaFetch<SummaryActivity[]>('/athlete/activities', { query });
        if (!activities.length) return textResponse('No activities found in the given range.');

        const body = activities.map(formatActivityLine).join('\n');
        return textResponse(`Page ${page} — ${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}:\n\n${body}`);
      } catch (error) {
        return errorResponse('Failed to list activities', error);
      }
    },
  );

  server.tool(
    'strava_get_activity',
    'Get full details for a specific Strava activity by ID.',
    {
      activity_id: z.number().int().min(1).describe('Strava activity ID (from strava_list_activities)'),
      include_all_efforts: z.boolean().default(false).describe('Include all segment efforts (verbose)'),
    },
    async ({ activity_id, include_all_efforts }) => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();

        const a = await stravaFetch<DetailedActivity>(`/activities/${activity_id}`, {
          query: { include_all_efforts },
        });

        const lines: string[] = [
          `**${a.name}** (id: ${a.id})`,
          `Sport: ${a.sport_type ?? a.type ?? '?'}${a.trainer ? ' (trainer)' : ''}${a.commute ? ' (commute)' : ''}${a.manual ? ' (manual)' : ''}`,
          `Start: ${a.start_date_local ?? a.start_date ?? '?'} (${a.timezone ?? '?'})`,
          `Distance: ${formatDistance(a.distance)}`,
          `Moving time: ${formatDuration(a.moving_time)} / Elapsed: ${formatDuration(a.elapsed_time)}`,
        ];
        if (a.average_speed) lines.push(`Avg speed: ${(a.average_speed * 3.6).toFixed(2)} km/h (pace ${formatPace(a.average_speed)})`);
        if (a.max_speed) lines.push(`Max speed: ${(a.max_speed * 3.6).toFixed(2)} km/h`);
        if (a.total_elevation_gain != null) lines.push(`Elevation gain: ${Math.round(a.total_elevation_gain)} m`);
        if (a.average_heartrate) lines.push(`HR: avg ${Math.round(a.average_heartrate)} / max ${Math.round(a.max_heartrate ?? 0)}`);
        if (a.average_watts) lines.push(`Power: avg ${Math.round(a.average_watts)} W${a.weighted_average_watts ? ` / NP ${Math.round(a.weighted_average_watts)} W` : ''}${a.kilojoules ? ` / ${Math.round(a.kilojoules)} kJ` : ''}`);
        if (a.calories) lines.push(`Calories: ${a.calories}`);
        if (a.suffer_score) lines.push(`Relative effort: ${a.suffer_score}`);
        if (a.location_city || a.location_country) lines.push(`Location: ${[a.location_city, a.location_country].filter(Boolean).join(', ')}`);
        if (a.gear_id) lines.push(`Gear: ${a.gear_id}`);
        if (a.device_name) lines.push(`Device: ${a.device_name}`);
        lines.push(`Kudos: ${a.kudos_count ?? 0} · Comments: ${a.comment_count ?? 0} · Achievements: ${a.achievement_count ?? 0} · PRs: ${a.pr_count ?? 0}`);
        if (a.description) lines.push(`\nDescription:\n${a.description}`);

        if (a.splits_metric?.length) {
          lines.push(`\n**Splits (per km):**`);
          for (const s of a.splits_metric) {
            const pace = formatPace(s.average_speed);
            const hr = s.average_heartrate ? ` · HR ${Math.round(s.average_heartrate)}` : '';
            lines.push(`  ${s.split}. ${formatDistance(s.distance)} in ${formatDuration(s.elapsed_time)} (${pace})${hr}`);
          }
        }

        if (a.best_efforts?.length) {
          lines.push(`\n**Best efforts:**`);
          for (const e of a.best_efforts) {
            const pr = e.pr_rank ? ` 🏆 PR #${e.pr_rank}` : '';
            lines.push(`  ${e.name}: ${formatDuration(e.elapsed_time)}${pr}`);
          }
        }

        if (include_all_efforts && a.segment_efforts?.length) {
          lines.push(`\n**Segment efforts (${a.segment_efforts.length}):**`);
          for (const e of a.segment_efforts.slice(0, 50)) {
            const pr = e.pr_rank ? ` 🏆 PR #${e.pr_rank}` : '';
            lines.push(`  ${e.name} (segment ${e.id}): ${formatDistance(e.distance)} in ${formatDuration(e.elapsed_time)}${pr}`);
          }
          if (a.segment_efforts.length > 50) lines.push(`  …and ${a.segment_efforts.length - 50} more`);
        }

        return textResponse(lines.join('\n'));
      } catch (error) {
        return errorResponse('Failed to fetch activity', error);
      }
    },
  );

  // ---------- Stats & zones ----------

  server.tool(
    'strava_get_athlete_stats',
    'Get totals for the authenticated athlete (recent 4 weeks, year-to-date, all time) broken down by ride/run/swim.',
    {},
    async () => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();
        const athleteId = await requireAthleteId();

        const stats = await stravaFetch<AthleteStats>(`/athletes/${athleteId}/stats`);
        const sections: string[] = [];

        if (stats.biggest_ride_distance) sections.push(`Biggest ride: ${formatDistance(stats.biggest_ride_distance)}`);
        if (stats.biggest_climb_elevation_gain) sections.push(`Biggest climb: +${Math.round(stats.biggest_climb_elevation_gain)} m`);

        const periods: Array<[string, AthleteStats[keyof AthleteStats] | undefined, AthleteStats[keyof AthleteStats] | undefined, AthleteStats[keyof AthleteStats] | undefined]> = [
          ['Recent (4 weeks)', stats.recent_ride_totals, stats.recent_run_totals, stats.recent_swim_totals],
          ['Year-to-date', stats.ytd_ride_totals, stats.ytd_run_totals, stats.ytd_swim_totals],
          ['All time', stats.all_ride_totals, stats.all_run_totals, stats.all_swim_totals],
        ];

        for (const [label, ride, run, swim] of periods) {
          const rideLine = formatStatsTotal('  Ride', ride as AthleteStatsTotal | undefined);
          const runLine = formatStatsTotal('  Run', run as AthleteStatsTotal | undefined);
          const swimLine = formatStatsTotal('  Swim', swim as AthleteStatsTotal | undefined);
          const lines = [rideLine, runLine, swimLine].filter(Boolean);
          if (lines.length) sections.push(`**${label}:**\n${lines.join('\n')}`);
        }

        return textResponse(sections.length ? sections.join('\n\n') : 'No stats available.');
      } catch (error) {
        return errorResponse('Failed to fetch athlete stats', error);
      }
    },
  );

  server.tool(
    'strava_get_athlete_zones',
    'Get the authenticated athlete\'s heart rate and power training zones (premium feature).',
    {},
    async () => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();

        const z = await stravaFetch<AthleteZones>('/athlete/zones');
        const lines: string[] = [];
        if (z.heart_rate?.zones?.length) {
          lines.push(`**Heart rate zones${z.heart_rate.custom_zones ? ' (custom)' : ''}:**`);
          z.heart_rate.zones.forEach((zone, i) => {
            const max = zone.max === -1 ? '∞' : zone.max;
            lines.push(`  Z${i + 1}: ${zone.min}–${max} bpm`);
          });
        } else {
          lines.push('No heart rate zones configured.');
        }
        if (z.power?.zones?.length) {
          lines.push(`\n**Power zones:**`);
          z.power.zones.forEach((zone, i) => {
            const max = zone.max === -1 ? '∞' : zone.max;
            lines.push(`  Z${i + 1}: ${zone.min}–${max} W`);
          });
        }
        return textResponse(lines.join('\n'));
      } catch (error) {
        return errorResponse('Failed to fetch zones', error);
      }
    },
  );

  // ---------- Activity streams ----------

  server.tool(
    'strava_get_activity_streams',
    'Get time-series streams (heartrate, watts, cadence, pace, GPS, etc.) for an activity. Returns summary stats per stream by default; set `include_data` to true for raw arrays.',
    {
      activity_id: z.number().int().min(1).describe('Strava activity ID'),
      keys: z
        .array(z.enum(['time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth']))
        .min(1)
        .default(['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude'])
        .describe('Which streams to fetch'),
      resolution: z.enum(['low', 'medium', 'high']).default('low').describe('Sampling resolution: low ~100 points, medium ~1000, high all points'),
      series_type: z.enum(['distance', 'time']).default('distance').describe('Base series for downsampling'),
      include_data: z.boolean().default(false).describe('If true, include raw data arrays in the response (can be large)'),
    },
    async ({ activity_id, keys, resolution, series_type, include_data }) => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();

        const streams = await stravaFetch<Record<string, StreamData>>(`/activities/${activity_id}/streams`, {
          query: {
            keys: keys.join(','),
            key_by_type: true,
            resolution,
            series_type,
          },
        });

        const lines: string[] = [`Streams for activity ${activity_id} (resolution: ${resolution}, series: ${series_type}):`, ''];
        for (const key of keys) {
          const stream = streams[key];
          if (!stream?.data?.length) {
            lines.push(`- **${key}**: not available`);
            continue;
          }
          const data = stream.data;
          if (key === 'latlng') {
            const first = data[0] as [number, number] | undefined;
            const last = data[data.length - 1] as [number, number] | undefined;
            lines.push(`- **latlng**: ${data.length} points · start ${first?.join(',')} → end ${last?.join(',')}`);
          } else if (key === 'moving') {
            const movingCount = (data as number[]).filter(Boolean).length;
            lines.push(`- **moving**: ${movingCount}/${data.length} samples moving`);
          } else {
            lines.push(`- **${key}**: ${summarizeNumericStream(data as number[])}`);
          }
          if (include_data) {
            const json = JSON.stringify(data);
            const preview = json.length > 4000 ? `${json.slice(0, 4000)}…(truncated, ${data.length} total)` : json;
            lines.push(`  data: ${preview}`);
          }
        }
        return textResponse(lines.join('\n'));
      } catch (error) {
        return errorResponse('Failed to fetch streams', error);
      }
    },
  );

  // ---------- Routes & segments ----------

  server.tool(
    'strava_list_athlete_routes',
    'List routes created by the authenticated athlete.',
    {
      page: z.number().int().min(1).default(1).describe('Page number (1-indexed)'),
      per_page: z.number().int().min(1).max(200).default(30).describe('Routes per page'),
    },
    async ({ page, per_page }) => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();
        const athleteId = await requireAthleteId();

        const routes = await stravaFetch<Route[]>(`/athletes/${athleteId}/routes`, {
          query: { page, per_page },
        });
        if (!routes.length) return textResponse('No routes found.');

        const lines = routes.map((r) => {
          const star = r.starred ? ' ⭐' : '';
          const priv = r.private ? ' (private)' : '';
          return `• **${r.name}** (id: ${r.id})${star}${priv} — ${formatDistance(r.distance)}, +${Math.round(r.elevation_gain ?? 0)}m, est ${formatDuration(r.estimated_moving_time)}`;
        });
        return textResponse(`Page ${page} — ${routes.length} route(s):\n\n${lines.join('\n')}`);
      } catch (error) {
        return errorResponse('Failed to list routes', error);
      }
    },
  );

  server.tool(
    'strava_get_segment',
    'Get details for a specific Strava segment by ID.',
    {
      segment_id: z.number().int().min(1).describe('Strava segment ID'),
    },
    async ({ segment_id }) => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();

        const s = await stravaFetch<Segment>(`/segments/${segment_id}`);
        const lines = [
          `**${s.name}** (segment ${s.id})`,
          `Activity: ${s.activity_type ?? '?'}`,
          `Location: ${[s.city, s.state, s.country].filter(Boolean).join(', ') || '—'}`,
          `Distance: ${formatDistance(s.distance)}`,
          `Grade: avg ${s.average_grade?.toFixed(1) ?? '?'}% / max ${s.maximum_grade?.toFixed(1) ?? '?'}%`,
          `Elevation: ${Math.round(s.elevation_low ?? 0)}–${Math.round(s.elevation_high ?? 0)} m (+${Math.round(s.total_elevation_gain ?? 0)} m)`,
          `Climb category: ${s.climb_category ?? 0}`,
          `Efforts: ${s.effort_count ?? 0} · Athletes: ${s.athlete_count ?? 0} · Stars: ${s.star_count ?? 0}`,
        ];
        if (s.private) lines.push('Private: yes');
        return textResponse(lines.join('\n'));
      } catch (error) {
        return errorResponse('Failed to fetch segment', error);
      }
    },
  );

  server.tool(
    'strava_explore_segments',
    'Search popular segments within a geographic bounding box.',
    {
      sw_lat: z.number().min(-90).max(90).describe('Southwest corner latitude'),
      sw_lng: z.number().min(-180).max(180).describe('Southwest corner longitude'),
      ne_lat: z.number().min(-90).max(90).describe('Northeast corner latitude'),
      ne_lng: z.number().min(-180).max(180).describe('Northeast corner longitude'),
      activity_type: z.enum(['running', 'riding']).default('riding').describe('Activity type for the segment'),
      min_cat: z.number().int().min(0).max(5).optional().describe('Minimum climb category (cycling only, 0–5)'),
      max_cat: z.number().int().min(0).max(5).optional().describe('Maximum climb category (cycling only, 0–5)'),
    },
    async ({ sw_lat, sw_lng, ne_lat, ne_lng, activity_type, min_cat, max_cat }) => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) return notConnectedResponse();

        const result = await stravaFetch<{ segments?: ExploreSegment[] }>(`/segments/explore`, {
          query: {
            bounds: `${sw_lat},${sw_lng},${ne_lat},${ne_lng}`,
            activity_type,
            min_cat,
            max_cat,
          },
        });
        const segments = result.segments ?? [];
        if (!segments.length) return textResponse('No segments found in the given bounds.');

        const lines = segments.map((s) => {
          const cat = s.climb_category_desc && s.climb_category_desc !== 'NC' ? ` (${s.climb_category_desc})` : '';
          return `• **${s.name}** (id: ${s.id})${cat} — ${formatDistance(s.distance)}, avg ${s.avg_grade?.toFixed(1) ?? '?'}%, +${Math.round(s.elev_difference ?? 0)}m`;
        });
        return textResponse(`Found ${segments.length} segment(s):\n\n${lines.join('\n')}`);
      } catch (error) {
        return errorResponse('Failed to explore segments', error);
      }
    },
  );
}
