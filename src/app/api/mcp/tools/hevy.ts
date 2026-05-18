import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const HEVY_BASE_URL = 'https://api.hevyapp.com/v1';

const setSchema = z.object({
  type: z.string().default('normal').describe('Set type: normal, warmup, failure, dropset'),
  weight_kg: z.number().nullable().optional().describe('Weight in kilograms'),
  reps: z.number().int().nullable().optional().describe('Number of reps'),
  distance_meters: z.number().nullable().optional().describe('Distance in meters (for cardio)'),
  duration_seconds: z.number().int().nullable().optional().describe('Duration in seconds (for timed sets)'),
  rpe: z.number().nullable().optional().describe('Rate of perceived exertion (0-10)'),
});

const exerciseSchema = z.object({
  exercise_template_id: z.string().describe('Hevy exercise template ID (use hevy_search_exercises to find one)'),
  notes: z.string().optional().describe('Optional notes for the exercise'),
  superset_id: z.number().int().nullable().optional().describe('Superset grouping ID; exercises sharing this ID are supersetted'),
  sets: z.array(setSchema).describe('Sets for this exercise'),
});

type HevyExerciseInput = z.infer<typeof exerciseSchema>;

function buildExercisePayload(exercises: HevyExerciseInput[]) {
  return exercises.map((ex) => ({
    exercise_template_id: ex.exercise_template_id,
    superset_id: ex.superset_id ?? null,
    notes: ex.notes ?? '',
    sets: ex.sets.map((s) => ({
      type: s.type ?? 'normal',
      weight_kg: s.weight_kg ?? null,
      reps: s.reps ?? null,
      distance_meters: s.distance_meters ?? null,
      duration_seconds: s.duration_seconds ?? null,
      rpe: s.rpe ?? null,
    })),
  }));
}

async function hevyFetch(
  path: string,
  init?: { method?: string; query?: Record<string, string | number | undefined>; body?: unknown },
): Promise<unknown> {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    throw new Error('HEVY_API_KEY environment variable is not set. Add your Hevy API key (Settings > API in the Hevy app) to the project environment.');
  }

  const url = new URL(`${HEVY_BASE_URL}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'api-key': apiKey,
    'Accept': 'application/json',
  };
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Hevy API ${response.status} ${response.statusText}: ${errorText || '(no body)'}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function textResponse(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResponse(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return textResponse(`${label}: ${message}`);
}

export function registerHevyTools(server: McpServer) {
  // ---------- Read tools ----------

  server.tool(
    'hevy_get_workout_count',
    'Get the total number of workouts logged in your Hevy account.',
    {},
    async () => {
      try {
        const data = (await hevyFetch('/workouts/count')) as { workout_count?: number };
        return textResponse(`Total workouts logged: ${data.workout_count ?? 0}`);
      } catch (error) {
        return errorResponse('Failed to fetch workout count', error);
      }
    },
  );

  server.tool(
    'hevy_list_workouts',
    'List logged workouts in your Hevy account with pagination.',
    {
      page: z.number().int().min(1).default(1).describe('Page number (1-indexed)'),
      page_size: z.number().int().min(1).max(10).default(5).describe('Number of workouts per page (max 10 per Hevy API)'),
    },
    async ({ page, page_size }) => {
      try {
        const data = (await hevyFetch('/workouts', {
          query: { page, pageSize: page_size },
        })) as { workouts?: Array<{ id: string; title?: string; start_time?: string; end_time?: string }>; page?: number; page_count?: number };

        const workouts = data.workouts ?? [];
        if (workouts.length === 0) {
          return textResponse(`No workouts found on page ${page}.`);
        }

        const lines = workouts.map((w) => `* **${w.title || '(untitled)'}** — ${w.start_time || '?'} → ${w.end_time || '?'} (id: ${w.id})`);
        return textResponse(`Page ${data.page ?? page} of ${data.page_count ?? '?'} — ${workouts.length} workout(s):\n\n${lines.join('\n')}`);
      } catch (error) {
        return errorResponse('Failed to list workouts', error);
      }
    },
  );

  server.tool(
    'hevy_get_workout',
    'Get full details (exercises, sets, weights, reps) for a specific workout by ID.',
    {
      workout_id: z.string().describe('The workout ID to retrieve (from hevy_list_workouts)'),
    },
    async ({ workout_id }) => {
      try {
        const w = (await hevyFetch(`/workouts/${encodeURIComponent(workout_id)}`)) as {
          id: string;
          title?: string;
          description?: string;
          start_time?: string;
          end_time?: string;
          exercises?: Array<{
            index?: number;
            title?: string;
            exercise_template_id?: string;
            notes?: string;
            sets?: Array<{ index?: number; set_type?: string; type?: string; weight_kg?: number | null; reps?: number | null; distance_meters?: number | null; duration_seconds?: number | null; rpe?: number | null }>;
          }>;
        };

        const exerciseLines = (w.exercises ?? []).map((e, ei) => {
          const setLines = (e.sets ?? []).map((s, si) => {
            const parts: string[] = [`#${s.index ?? si + 1} (${s.set_type ?? s.type ?? 'normal'})`];
            if (s.weight_kg != null) parts.push(`${s.weight_kg}kg`);
            if (s.reps != null) parts.push(`${s.reps} reps`);
            if (s.distance_meters != null) parts.push(`${s.distance_meters}m`);
            if (s.duration_seconds != null) parts.push(`${s.duration_seconds}s`);
            if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
            return `    - ${parts.join(' · ')}`;
          });
          return `  ${ei + 1}. **${e.title || '(unnamed)'}** (template ${e.exercise_template_id || '?'})${e.notes ? `\n     Notes: ${e.notes}` : ''}\n${setLines.join('\n') || '    (no sets)'}`;
        });

        return textResponse(
          `**${w.title || '(untitled)'}**\n` +
            `${w.start_time || '?'} → ${w.end_time || '?'}\n` +
            `ID: ${w.id}\n` +
            (w.description ? `\n${w.description}\n` : '') +
            `\nExercises:\n${exerciseLines.join('\n') || '(none)'}`,
        );
      } catch (error) {
        return errorResponse('Failed to get workout', error);
      }
    },
  );

  server.tool(
    'hevy_list_routines',
    'List saved workout routines in your Hevy account with pagination.',
    {
      page: z.number().int().min(1).default(1).describe('Page number (1-indexed)'),
      page_size: z.number().int().min(1).max(10).default(5).describe('Number of routines per page (max 10 per Hevy API)'),
    },
    async ({ page, page_size }) => {
      try {
        const data = (await hevyFetch('/routines', {
          query: { page, pageSize: page_size },
        })) as { routines?: Array<{ id: string; title?: string; folder_id?: number | null }>; page?: number; page_count?: number };

        const routines = data.routines ?? [];
        if (routines.length === 0) {
          return textResponse(`No routines found on page ${page}.`);
        }

        const lines = routines.map((r) => `* **${r.title || '(untitled)'}** (id: ${r.id}${r.folder_id != null ? `, folder ${r.folder_id}` : ''})`);
        return textResponse(`Page ${data.page ?? page} of ${data.page_count ?? '?'} — ${routines.length} routine(s):\n\n${lines.join('\n')}`);
      } catch (error) {
        return errorResponse('Failed to list routines', error);
      }
    },
  );

  server.tool(
    'hevy_get_routine',
    'Get full details (exercises and sets) for a specific routine by ID.',
    {
      routine_id: z.string().describe('The routine ID to retrieve (from hevy_list_routines)'),
    },
    async ({ routine_id }) => {
      try {
        const r = (await hevyFetch(`/routines/${encodeURIComponent(routine_id)}`)) as {
          id: string;
          title?: string;
          folder_id?: number | null;
          exercises?: Array<{
            title?: string;
            exercise_template_id?: string;
            notes?: string;
            sets?: Array<{ type?: string; weight_kg?: number | null; reps?: number | null }>;
          }>;
        };

        const exerciseLines = (r.exercises ?? []).map((e, ei) => {
          const setLines = (e.sets ?? []).map((s, si) => {
            const parts: string[] = [`#${si + 1} (${s.type ?? 'normal'})`];
            if (s.weight_kg != null) parts.push(`${s.weight_kg}kg`);
            if (s.reps != null) parts.push(`${s.reps} reps`);
            return `    - ${parts.join(' · ')}`;
          });
          return `  ${ei + 1}. **${e.title || '(unnamed)'}** (template ${e.exercise_template_id || '?'})${e.notes ? `\n     Notes: ${e.notes}` : ''}\n${setLines.join('\n') || '    (no sets)'}`;
        });

        return textResponse(
          `**${r.title || '(untitled)'}**\nID: ${r.id}${r.folder_id != null ? `\nFolder: ${r.folder_id}` : ''}\n\nExercises:\n${exerciseLines.join('\n') || '(none)'}`,
        );
      } catch (error) {
        return errorResponse('Failed to get routine', error);
      }
    },
  );

  server.tool(
    'hevy_search_exercises',
    'Search Hevy exercise templates by name. Returns matching templates with their IDs (needed to create workouts/routines). Note: the Hevy API does not provide a server-side search, so this scans one page at a time and filters locally.',
    {
      query: z.string().describe('Search query (case-insensitive substring match on exercise title)'),
      page: z.number().int().min(1).default(1).describe('Page of exercise templates to scan (1-indexed). Increase to search beyond the first page.'),
    },
    async ({ query, page }) => {
      try {
        const data = (await hevyFetch('/exercise_templates', {
          query: { page, pageSize: 100 },
        })) as {
          exercise_templates?: Array<{
            id: string;
            title?: string;
            type?: string;
            primary_muscle_group?: string;
            secondary_muscle_groups?: string[];
            is_custom?: boolean;
          }>;
          page?: number;
          page_count?: number;
        };

        const q = query.toLowerCase();
        const matches = (data.exercise_templates ?? []).filter((t) => (t.title || '').toLowerCase().includes(q));

        if (matches.length === 0) {
          return textResponse(
            `No exercise templates matching "${query}" on page ${page} of ${data.page_count ?? '?'}.${(data.page_count ?? 1) > page ? ' Try a higher page number.' : ''}`,
          );
        }

        const lines = matches.map(
          (t) =>
            `* **${t.title}** (id: ${t.id}) — ${t.type || 'unknown'} · ${t.primary_muscle_group || 'unknown'}${t.secondary_muscle_groups?.length ? ` (also: ${t.secondary_muscle_groups.join(', ')})` : ''}${t.is_custom ? ' [custom]' : ''}`,
        );
        return textResponse(
          `Found ${matches.length} template(s) matching "${query}" on page ${data.page ?? page} of ${data.page_count ?? '?'}:\n\n${lines.join('\n')}`,
        );
      } catch (error) {
        return errorResponse('Failed to search exercises', error);
      }
    },
  );

  // ---------- Write tools ----------

  server.tool(
    'hevy_create_workout',
    'Log a new workout in Hevy. Provide the title, ISO 8601 start/end times, and exercises with their sets.',
    {
      title: z.string().describe('Title for the workout'),
      start_time: z.string().describe('ISO 8601 start time, e.g. 2024-01-15T10:00:00Z'),
      end_time: z.string().describe('ISO 8601 end time, e.g. 2024-01-15T11:00:00Z'),
      description: z.string().default('').describe('Optional workout description'),
      exercises: z.array(exerciseSchema).describe('Exercises performed (use hevy_search_exercises to find template IDs)'),
    },
    async ({ title, start_time, end_time, description, exercises }) => {
      try {
        const data = (await hevyFetch('/workouts', {
          method: 'POST',
          body: {
            workout: {
              title,
              description,
              start_time,
              end_time,
              exercises: buildExercisePayload(exercises),
            },
          },
        })) as { id?: string };
        return textResponse(`Workout created successfully. ID: ${data.id ?? '(unknown)'}`);
      } catch (error) {
        return errorResponse('Failed to create workout', error);
      }
    },
  );

  server.tool(
    'hevy_update_workout',
    'Update an existing workout in Hevy. Note: this fully replaces the workout — provide all fields and exercises.',
    {
      workout_id: z.string().describe('ID of the workout to update'),
      title: z.string().describe('Updated title'),
      start_time: z.string().describe('ISO 8601 start time'),
      end_time: z.string().describe('ISO 8601 end time'),
      description: z.string().default('').describe('Optional workout description'),
      exercises: z.array(exerciseSchema).describe('Updated exercises (full replacement)'),
    },
    async ({ workout_id, title, start_time, end_time, description, exercises }) => {
      try {
        await hevyFetch(`/workouts/${encodeURIComponent(workout_id)}`, {
          method: 'PUT',
          body: {
            workout: {
              title,
              description,
              start_time,
              end_time,
              exercises: buildExercisePayload(exercises),
            },
          },
        });
        return textResponse(`Workout ${workout_id} updated successfully.`);
      } catch (error) {
        return errorResponse('Failed to update workout', error);
      }
    },
  );

  server.tool(
    'hevy_create_routine',
    'Create a new workout routine in Hevy.',
    {
      title: z.string().describe('Title for the routine'),
      folder_id: z.number().int().nullable().optional().describe('Optional folder ID to place the routine in'),
      exercises: z.array(exerciseSchema).describe('Exercises in the routine (use hevy_search_exercises to find template IDs)'),
    },
    async ({ title, folder_id, exercises }) => {
      try {
        const data = (await hevyFetch('/routines', {
          method: 'POST',
          body: {
            routine: {
              title,
              folder_id: folder_id ?? null,
              exercises: buildExercisePayload(exercises),
            },
          },
        })) as { id?: string };
        return textResponse(`Routine created successfully. ID: ${data.id ?? '(unknown)'}`);
      } catch (error) {
        return errorResponse('Failed to create routine', error);
      }
    },
  );

  server.tool(
    'hevy_update_routine',
    'Update an existing routine in Hevy. Note: this fully replaces the routine — provide all fields and exercises.',
    {
      routine_id: z.string().describe('ID of the routine to update'),
      title: z.string().describe('Updated title'),
      folder_id: z.number().int().nullable().optional().describe('Optional folder ID'),
      exercises: z.array(exerciseSchema).describe('Updated exercises (full replacement)'),
    },
    async ({ routine_id, title, folder_id, exercises }) => {
      try {
        await hevyFetch(`/routines/${encodeURIComponent(routine_id)}`, {
          method: 'PUT',
          body: {
            routine: {
              title,
              folder_id: folder_id ?? null,
              exercises: buildExercisePayload(exercises),
            },
          },
        });
        return textResponse(`Routine ${routine_id} updated successfully.`);
      } catch (error) {
        return errorResponse('Failed to update routine', error);
      }
    },
  );
}
