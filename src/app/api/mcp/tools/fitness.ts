import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createFitnessGoal,
  getFitnessGoals,
  updateFitnessGoal,
  deleteFitnessGoal,
  logGoalProgress,
  getGoalProgress,
  calculateGoalProgress,
  createTrainingProgram,
  getTrainingPrograms,
  updateTrainingProgram,
  deleteTrainingProgram,
  addProgramPhase,
  addSessionTemplate,
  bulkAddSessionTemplates,
  getActiveProgram,
  upsertNutritionDay,
  getNutritionDays,
  getNutritionSummary,
  createWorkoutLog,
  getWorkoutLogs,
  upsertBodyMeasurement,
  getBodyMeasurements,
  createStrengthPR,
  getStrengthPRs,
  getProgressSummary,
  getWeeklySummary,
} from '@/lib/fitness/queries';
import {
  GoalType,
  GoalDirection,
  ProgramPhase,
  SessionType,
  MeasurementSource,
  BulkSessionInput,
} from '@/lib/fitness/types';

export function registerFitnessTools(server: McpServer): void {
  // ==========================================
  // Fitness & Health Tracking Tools
  // ==========================================

  // Create a fitness goal
  server.tool(
    'fitness_goal_create',
    'Create a new fitness goal (weight, strength, running, VO2max, etc.)',
    {
      name: z.string().describe('Goal name (e.g., "Lose 10kg", "Squat 100kg")'),
      goalType: z.enum(['WEIGHT', 'BODY_FAT', 'STRENGTH', 'RUNNING_PACE', 'RUNNING_DISTANCE', 'RACE_TIME', 'VO2MAX', 'RESTING_HR', 'CUSTOM']).describe('Type of goal'),
      direction: z.enum(['INCREASE', 'DECREASE', 'MAINTAIN']).optional().describe('Direction to target (default: DECREASE)'),
      targetValue: z.number().describe('Target value to achieve'),
      targetUnit: z.string().describe('Unit of measurement (kg, %, min, km, bpm, etc.)'),
      startValue: z.number().optional().describe('Starting value (current measurement)'),
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      targetDate: z.string().optional().describe('Target date to achieve goal (YYYY-MM-DD)'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (params) => {
      try {
        const goal = await createFitnessGoal({
          name: params.name,
          goalType: params.goalType as GoalType,
          direction: (params.direction as GoalDirection) ?? GoalDirection.DECREASE,
          targetValue: params.targetValue,
          targetUnit: params.targetUnit,
          startValue: params.startValue,
          startDate: new Date(params.startDate),
          targetDate: params.targetDate ? new Date(params.targetDate) : undefined,
          notes: params.notes,
        });

        return {
          content: [{
            type: 'text',
            text: `Goal created: ${goal.name}\n\n` +
                  `Type: ${goal.goalType}\n` +
                  `Target: ${goal.targetValue} ${goal.targetUnit} (${goal.direction})\n` +
                  (goal.startValue ? `Start: ${goal.startValue} ${goal.targetUnit}\n` : '') +
                  `Start Date: ${goal.startDate.toISOString().split('T')[0]}\n` +
                  (goal.targetDate ? `Target Date: ${goal.targetDate.toISOString().split('T')[0]}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in fitness_goal_create:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // List fitness goals
  server.tool(
    'fitness_goal_list',
    'List all fitness goals with progress status',
    {
      goalType: z.enum(['WEIGHT', 'BODY_FAT', 'STRENGTH', 'RUNNING_PACE', 'RUNNING_DISTANCE', 'RACE_TIME', 'VO2MAX', 'RESTING_HR', 'CUSTOM']).optional().describe('Filter by goal type'),
      includeCompleted: z.boolean().optional().describe('Include completed goals (default: true)'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results to return'),
    },
    async (params) => {
      try {
        const goals = await getFitnessGoals({
          goalType: params.goalType as GoalType | undefined,
          includeCompleted: params.includeCompleted ?? true,
          limit: params.limit,
        });

        if (goals.length === 0) {
          return { content: [{ type: 'text', text: 'No fitness goals found.' }] };
        }

        // Get progress for each goal
        const goalsWithProgress = await Promise.all(
          goals.map(async (g) => {
            const progress = await calculateGoalProgress(g.id);
            return { goal: g, progress };
          })
        );

        const lines = goalsWithProgress.map(({ goal, progress }) => {
          const status = goal.isCompleted ? 'COMPLETED' : (progress?.isOnTrack ? 'ON_TRACK' : 'BEHIND');
          const progressPct = progress ? `${progress.progressPercent.toFixed(1)}%` : 'N/A';
          return `[${status}] ${goal.name}\n` +
                 `   Type: ${goal.goalType} | Target: ${goal.targetValue} ${goal.targetUnit}\n` +
                 `   Current: ${goal.currentValue ?? 'Not logged'} | Progress: ${progressPct}`;
        });

        return {
          content: [{ type: 'text', text: `Fitness Goals (${goals.length}):\n\n${lines.join('\n\n')}` }]
        };
      } catch (error) {
        console.error('Error in fitness_goal_list:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Update a fitness goal
  server.tool(
    'fitness_goal_update',
    'Update a fitness goal or mark as completed',
    {
      goalId: z.string().describe('Goal ID to update'),
      name: z.string().optional().describe('New goal name'),
      targetValue: z.number().optional().describe('New target value'),
      targetDate: z.string().optional().describe('New target date (YYYY-MM-DD)'),
      currentValue: z.number().optional().describe('Update current value'),
      isCompleted: z.boolean().optional().describe('Mark as completed'),
      notes: z.string().optional().describe('Update notes'),
    },
    async (params) => {
      try {
        const goal = await updateFitnessGoal(params.goalId, {
          name: params.name,
          targetValue: params.targetValue,
          targetDate: params.targetDate ? new Date(params.targetDate) : undefined,
          currentValue: params.currentValue,
          isCompleted: params.isCompleted,
          notes: params.notes,
        });

        return {
          content: [{
            type: 'text',
            text: `Goal updated: ${goal.name}\n\n` +
                  `Target: ${goal.targetValue} ${goal.targetUnit}\n` +
                  `Current: ${goal.currentValue ?? 'Not logged'}\n` +
                  `Status: ${goal.isCompleted ? 'Completed' : 'In Progress'}`
          }]
        };
      } catch (error) {
        console.error('Error in fitness_goal_update:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Delete a fitness goal
  server.tool(
    'fitness_goal_delete',
    'Delete a fitness goal and its progress logs',
    {
      goalId: z.string().describe('Goal ID to delete'),
      confirm: z.boolean().describe('Confirm deletion'),
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return { content: [{ type: 'text', text: 'Please confirm deletion by setting confirm: true' }] };
        }

        await deleteFitnessGoal(params.goalId);
        return { content: [{ type: 'text', text: 'Goal deleted successfully.' }] };
      } catch (error) {
        console.error('Error in fitness_goal_delete:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Log progress for a goal
  server.tool(
    'fitness_goal_log_progress',
    'Log a progress measurement for a fitness goal',
    {
      goalId: z.string().describe('Goal ID to log progress for'),
      date: z.string().describe('Date of measurement (YYYY-MM-DD)'),
      value: z.number().describe('Measured value'),
      source: z.enum(['MANUAL', 'APPLE_HEALTH', 'APP_SCREENSHOT']).optional().describe('Source of measurement'),
      notes: z.string().optional().describe('Notes about this measurement'),
    },
    async (params) => {
      try {
        const log = await logGoalProgress(
          params.goalId,
          new Date(params.date),
          params.value,
          (params.source as MeasurementSource) ?? MeasurementSource.MANUAL,
          params.notes
        );

        const progress = await calculateGoalProgress(params.goalId);

        return {
          content: [{
            type: 'text',
            text: `Progress logged!\n\n` +
                  `Value: ${log.value}\n` +
                  `Date: ${log.logDate.toISOString().split('T')[0]}\n` +
                  (progress ? `\nProgress: ${progress.progressPercent.toFixed(1)}%\n` +
                             `Remaining: ${progress.remainingToTarget.toFixed(2)} ${progress.targetUnit}\n` +
                             `Status: ${progress.isOnTrack ? 'On Track' : 'Behind Schedule'}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in fitness_goal_log_progress:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get progress history for a goal
  server.tool(
    'fitness_goal_get_progress',
    'Get progress history for a fitness goal',
    {
      goalId: z.string().describe('Goal ID'),
      startDate: z.string().optional().describe('Filter from date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('Filter to date (YYYY-MM-DD)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results'),
    },
    async (params) => {
      try {
        const logs = await getGoalProgress(params.goalId, {
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          limit: params.limit,
        });

        const progress = await calculateGoalProgress(params.goalId);

        if (logs.length === 0) {
          return { content: [{ type: 'text', text: 'No progress logs found for this goal.' }] };
        }

        const lines = logs.map(l =>
          `${l.logDate.toISOString().split('T')[0]}: ${l.value}${l.notes ? ` (${l.notes})` : ''}`
        );

        return {
          content: [{
            type: 'text',
            text: `Progress History (${logs.length} entries):\n\n` +
                  (progress ? `Current Progress: ${progress.progressPercent.toFixed(1)}%\n` +
                             `Target: ${progress.targetValue} ${progress.targetUnit}\n\n` : '') +
                  lines.join('\n')
          }]
        };
      } catch (error) {
        console.error('Error in fitness_goal_get_progress:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Create a training program
  server.tool(
    'fitness_program_create',
    'Create a new training program',
    {
      name: z.string().describe('Program name (e.g., "12-week Half Marathon")'),
      description: z.string().optional().describe('Program description'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (params) => {
      try {
        const program = await createTrainingProgram({
          name: params.name,
          description: params.description,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          notes: params.notes,
        });

        return {
          content: [{
            type: 'text',
            text: `Training program created: ${program.name}\n\n` +
                  `ID: ${program.id}\n` +
                  (program.startDate ? `Start: ${program.startDate.toISOString().split('T')[0]}\n` : '') +
                  (program.endDate ? `End: ${program.endDate.toISOString().split('T')[0]}\n` : '') +
                  `\nUse fitness_program_add_phase to add phases to this program.`
          }]
        };
      } catch (error) {
        console.error('Error in fitness_program_create:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // List training programs
  server.tool(
    'fitness_program_list',
    'List all training programs',
    {
      activeOnly: z.boolean().optional().describe('Only show active programs'),
    },
    async (params) => {
      try {
        const programs = await getTrainingPrograms(params.activeOnly ?? false);

        if (programs.length === 0) {
          return { content: [{ type: 'text', text: 'No training programs found.' }] };
        }

        const lines = programs.map(p => {
          const status = p.isActive ? 'Active' : 'Inactive';
          const phaseCount = p.phases?.length ?? 0;
          return `[${status}] ${p.name}\n` +
                 `   ID: ${p.id}\n` +
                 `   Phases: ${phaseCount}` +
                 (p.startDate ? ` | Start: ${p.startDate.toISOString().split('T')[0]}` : '');
        });

        return {
          content: [{ type: 'text', text: `Training Programs (${programs.length}):\n\n${lines.join('\n\n')}` }]
        };
      } catch (error) {
        console.error('Error in fitness_program_list:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Update training program
  server.tool(
    'fitness_program_update',
    'Update a training program or set as active',
    {
      programId: z.string().describe('Program ID'),
      name: z.string().optional().describe('New name'),
      description: z.string().optional().describe('New description'),
      startDate: z.string().optional().describe('New start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('New end date (YYYY-MM-DD)'),
      isActive: z.boolean().optional().describe('Set as active program (deactivates others)'),
      notes: z.string().optional().describe('Update notes'),
    },
    async (params) => {
      try {
        const program = await updateTrainingProgram(params.programId, {
          name: params.name,
          description: params.description,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          isActive: params.isActive,
          notes: params.notes,
        });

        return {
          content: [{
            type: 'text',
            text: `Program updated: ${program.name}\n\n` +
                  `Status: ${program.isActive ? 'Active' : 'Inactive'}`
          }]
        };
      } catch (error) {
        console.error('Error in fitness_program_update:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Delete training program
  server.tool(
    'fitness_program_delete',
    'Delete a training program and all its phases',
    {
      programId: z.string().describe('Program ID to delete'),
      confirm: z.boolean().describe('Confirm deletion'),
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return { content: [{ type: 'text', text: 'Please confirm deletion by setting confirm: true' }] };
        }

        await deleteTrainingProgram(params.programId);
        return { content: [{ type: 'text', text: 'Training program deleted.' }] };
      } catch (error) {
        console.error('Error in fitness_program_delete:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Add phase to program
  server.tool(
    'fitness_program_add_phase',
    'Add a training phase to a program',
    {
      programId: z.string().describe('Program ID'),
      name: z.string().describe('Phase name (e.g., "Base Building")'),
      phaseType: z.enum(['BASE', 'BUILD', 'PEAK', 'TAPER', 'RECOVERY', 'TRANSITION']).describe('Phase type'),
      weekNumber: z.number().int().min(1).describe('Starting week number'),
      durationWeeks: z.number().int().min(1).optional().describe('Duration in weeks (default: 1)'),
      focusAreas: z.array(z.string()).optional().describe('Focus areas for this phase'),
      notes: z.string().optional().describe('Phase notes'),
    },
    async (params) => {
      try {
        const phase = await addProgramPhase({
          programId: params.programId,
          name: params.name,
          phaseType: params.phaseType as ProgramPhase,
          weekNumber: params.weekNumber,
          durationWeeks: params.durationWeeks,
          focusAreas: params.focusAreas,
          notes: params.notes,
        });

        return {
          content: [{
            type: 'text',
            text: `Phase added: ${phase.name}\n\n` +
                  `Type: ${phase.phaseType}\n` +
                  `Weeks: ${phase.weekNumber} - ${phase.weekNumber + phase.durationWeeks - 1}\n` +
                  (phase.focusAreas ? `Focus: ${phase.focusAreas.join(', ')}` : '') +
                  `\n\nUse fitness_program_add_session to add sessions to this phase.`
          }]
        };
      } catch (error) {
        console.error('Error in fitness_program_add_phase:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Add session template to phase
  server.tool(
    'fitness_program_add_session',
    'Add a session template to a program phase',
    {
      phaseBlockId: z.string().describe('Phase block ID'),
      dayOfWeek: z.number().int().min(1).max(7).describe('Day of week (1=Monday, 7=Sunday)'),
      sessionType: z.enum(['STRENGTH', 'RUNNING', 'CARDIO', 'HIIT', 'FLEXIBILITY', 'REST', 'CROSS_TRAINING']).describe('Session type'),
      name: z.string().describe('Session name (e.g., "Upper Body Strength")'),
      description: z.string().optional().describe('Session description'),
      targetDuration: z.number().int().optional().describe('Target duration in minutes'),
      targetDistance: z.number().optional().describe('Target distance in km (for running)'),
      targetIntensity: z.string().optional().describe('Target intensity (e.g., "Zone 2", "RPE 7")'),
      notes: z.string().optional().describe('Session notes'),
    },
    async (params) => {
      try {
        const session = await addSessionTemplate({
          phaseBlockId: params.phaseBlockId,
          dayOfWeek: params.dayOfWeek,
          sessionType: params.sessionType as SessionType,
          name: params.name,
          description: params.description,
          targetDuration: params.targetDuration,
          targetDistance: params.targetDistance,
          targetIntensity: params.targetIntensity,
          notes: params.notes,
        });

        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        return {
          content: [{
            type: 'text',
            text: `Session added: ${session.name}\n\n` +
                  `Day: ${dayNames[session.dayOfWeek]}\n` +
                  `Type: ${session.sessionType}\n` +
                  (session.targetDuration ? `Duration: ${session.targetDuration} min\n` : '') +
                  (session.targetDistance ? `Distance: ${session.targetDistance} km\n` : '') +
                  (session.targetIntensity ? `Intensity: ${session.targetIntensity}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in fitness_program_add_session:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Bulk add session templates to phase
  server.tool(
    'fitness_program_bulk_add_sessions',
    'Add multiple session templates to a program phase in one call. Ideal for setting up a full training week.',
    {
      phaseBlockId: z.string().describe('Phase block ID'),
      sessions: z.array(z.object({
        dayOfWeek: z.number().int().min(1).max(7).describe('Day of week (1=Monday, 7=Sunday)'),
        sessionType: z.enum(['STRENGTH', 'RUNNING', 'CARDIO', 'HIIT', 'FLEXIBILITY', 'REST', 'CROSS_TRAINING']).describe('Session type'),
        name: z.string().describe('Session name (e.g., "Upper Body Strength")'),
        description: z.string().optional().describe('Session description'),
        targetDuration: z.number().int().optional().describe('Target duration in minutes'),
        targetDistance: z.number().optional().describe('Target distance in km (for running)'),
        targetIntensity: z.string().optional().describe('Target intensity (e.g., "Zone 2", "RPE 7")'),
        notes: z.string().optional().describe('Session notes'),
      })).describe('Array of session templates to add'),
    },
    async (params) => {
      try {
        const result = await bulkAddSessionTemplates({
          phaseBlockId: params.phaseBlockId,
          sessions: params.sessions.map(s => ({
            ...s,
            sessionType: s.sessionType as SessionType,
          })) as BulkSessionInput[],
        });

        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        let output = `Added ${result.count} session${result.count !== 1 ? 's' : ''} to phase\n\n`;

        for (const session of result.sessions) {
          output += `- ${dayNames[session.dayOfWeek]}: ${session.name} (${session.sessionType})`;
          if (session.targetDuration) output += ` - ${session.targetDuration}min`;
          if (session.targetDistance) output += ` - ${session.targetDistance}km`;
          output += '\n';
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in fitness_program_bulk_add_sessions:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get active program with current week schedule
  server.tool(
    'fitness_program_get_current',
    'Get the active training program with this week\'s schedule',
    {},
    async () => {
      try {
        const active = await getActiveProgram();

        if (!active) {
          return { content: [{ type: 'text', text: 'No active training program. Use fitness_program_update to set one as active.' }] };
        }

        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        let output = `Active Program: ${active.program.name}\n\n`;
        output += `Week ${active.currentWeek}`;
        if (active.currentPhase) {
          output += ` - ${active.currentPhase.name} (${active.currentPhase.phaseType})`;
        }
        output += '\n\n';

        if (active.weekSessions.length > 0) {
          output += `This Week's Sessions:\n`;
          for (const session of active.weekSessions) {
            output += `  ${dayNames[session.dayOfWeek]}: ${session.name} (${session.sessionType})`;
            if (session.targetDuration) output += ` - ${session.targetDuration}min`;
            if (session.targetDistance) output += ` - ${session.targetDistance}km`;
            output += '\n';
          }
        } else {
          output += 'No sessions scheduled for current week.';
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in fitness_program_get_current:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Log daily nutrition
  server.tool(
    'nutrition_log_day',
    'Log or update daily nutrition summary',
    {
      date: z.string().describe('Date (YYYY-MM-DD)'),
      caloriesBudget: z.number().int().optional().describe('Calorie/kJ budget for the day'),
      caloriesActual: z.number().int().optional().describe('Actual calories/kJ consumed'),
      proteinBudget: z.number().int().optional().describe('Protein budget in grams'),
      proteinActual: z.number().int().optional().describe('Actual protein in grams'),
      carbsBudget: z.number().int().optional().describe('Carbs budget in grams'),
      carbsActual: z.number().int().optional().describe('Actual carbs in grams'),
      fatBudget: z.number().int().optional().describe('Fat budget in grams'),
      fatActual: z.number().int().optional().describe('Actual fat in grams'),
      source: z.enum(['MANUAL', 'APPLE_HEALTH', 'APP_SCREENSHOT']).optional().describe('Data source'),
      notes: z.string().optional().describe('Notes'),
    },
    async (params) => {
      try {
        const day = await upsertNutritionDay({
          date: new Date(params.date),
          caloriesBudget: params.caloriesBudget,
          caloriesActual: params.caloriesActual,
          proteinBudget: params.proteinBudget,
          proteinActual: params.proteinActual,
          carbsBudget: params.carbsBudget,
          carbsActual: params.carbsActual,
          fatBudget: params.fatBudget,
          fatActual: params.fatActual,
          source: params.source as MeasurementSource | undefined,
          notes: params.notes,
        });

        let output = `Nutrition logged for ${day.date.toISOString().split('T')[0]}\n\n`;

        if (day.caloriesBudget || day.caloriesActual) {
          output += `Calories: ${day.caloriesActual ?? '?'} / ${day.caloriesBudget ?? '?'}`;
          if (day.caloriesVariance) output += ` (${day.caloriesVariance > 0 ? '+' : ''}${day.caloriesVariance})`;
          output += '\n';
        }
        if (day.proteinActual || day.proteinBudget) {
          output += `Protein: ${day.proteinActual ?? '?'}g / ${day.proteinBudget ?? '?'}g`;
          if (day.proteinVariance) output += ` (${day.proteinVariance > 0 ? '+' : ''}${day.proteinVariance}g)`;
          output += '\n';
        }
        if (day.carbsActual || day.carbsBudget) {
          output += `Carbs: ${day.carbsActual ?? '?'}g / ${day.carbsBudget ?? '?'}g\n`;
        }
        if (day.fatActual || day.fatBudget) {
          output += `Fat: ${day.fatActual ?? '?'}g / ${day.fatBudget ?? '?'}g\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in nutrition_log_day:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get nutrition days
  server.tool(
    'nutrition_get_days',
    'Get nutrition history for a date range',
    {
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results'),
    },
    async (params) => {
      try {
        const days = await getNutritionDays({
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          limit: params.limit ?? 7,
        });

        if (days.length === 0) {
          return { content: [{ type: 'text', text: 'No nutrition entries found.' }] };
        }

        const lines = days.map(d => {
          const dateStr = d.date.toISOString().split('T')[0];
          return `${dateStr}: ${d.caloriesActual ?? '?'} cal | P: ${d.proteinActual ?? '?'}g | C: ${d.carbsActual ?? '?'}g | F: ${d.fatActual ?? '?'}g`;
        });

        return {
          content: [{ type: 'text', text: `Nutrition History (${days.length} days):\n\n${lines.join('\n')}` }]
        };
      } catch (error) {
        console.error('Error in nutrition_get_days:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get nutrition summary
  server.tool(
    'nutrition_get_summary',
    'Get weekly or monthly nutrition averages and compliance',
    {
      period: z.enum(['WEEKLY', 'MONTHLY']).describe('Summary period'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD) - defaults to current period'),
    },
    async (params) => {
      try {
        const summary = await getNutritionSummary(
          params.period as 'WEEKLY' | 'MONTHLY',
          params.startDate ? new Date(params.startDate) : undefined
        );

        let output = `${params.period} Nutrition Summary\n`;
        output += `${summary.startDate.toISOString().split('T')[0]} to ${summary.endDate.toISOString().split('T')[0]}\n`;
        output += `Days Logged: ${summary.daysLogged}\n\n`;

        output += `Averages:\n`;
        output += `  Calories: ${summary.averages.caloriesActual ?? 'N/A'} / ${summary.averages.caloriesBudget ?? 'N/A'}\n`;
        output += `  Protein: ${summary.averages.proteinActual ?? 'N/A'}g / ${summary.averages.proteinBudget ?? 'N/A'}g\n`;
        output += `  Carbs: ${summary.averages.carbsActual ?? 'N/A'}g\n`;
        output += `  Fat: ${summary.averages.fatActual ?? 'N/A'}g\n\n`;

        output += `Compliance:\n`;
        output += `  Calories on target: ${summary.compliance.caloriesOnTarget}%\n`;
        output += `  Protein on target: ${summary.compliance.proteinOnTarget}%`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in nutrition_get_summary:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Log a workout
  server.tool(
    'fitness_log_workout',
    'Log a completed workout session',
    {
      date: z.string().describe('Workout date (YYYY-MM-DD)'),
      sessionType: z.enum(['STRENGTH', 'RUNNING', 'CARDIO', 'HIIT', 'FLEXIBILITY', 'REST', 'CROSS_TRAINING']).describe('Session type'),
      name: z.string().optional().describe('Workout name (e.g., "Gym Book: Upper Body")'),
      durationMinutes: z.number().int().optional().describe('Duration in minutes'),
      distanceKm: z.number().optional().describe('Distance in km (for cardio)'),
      avgPaceMinKm: z.number().optional().describe('Average pace in min/km (for running)'),
      caloriesBurned: z.number().int().optional().describe('Calories burned'),
      avgHeartRate: z.number().int().optional().describe('Average heart rate'),
      maxHeartRate: z.number().int().optional().describe('Max heart rate'),
      rpe: z.number().int().min(1).max(10).optional().describe('Rating of perceived exertion (1-10)'),
      source: z.enum(['MANUAL', 'APPLE_HEALTH', 'APP_SCREENSHOT']).optional().describe('Data source'),
      notes: z.string().optional().describe('Workout notes'),
    },
    async (params) => {
      try {
        const workout = await createWorkoutLog({
          logDate: new Date(params.date),
          sessionType: params.sessionType as SessionType,
          name: params.name,
          durationMinutes: params.durationMinutes,
          distanceKm: params.distanceKm,
          avgPaceMinKm: params.avgPaceMinKm,
          caloriesBurned: params.caloriesBurned,
          avgHeartRate: params.avgHeartRate,
          maxHeartRate: params.maxHeartRate,
          rpe: params.rpe,
          source: params.source as MeasurementSource | undefined,
          notes: params.notes,
        });

        let output = `Workout logged: ${workout.name ?? workout.sessionType}\n\n`;
        output += `Date: ${workout.logDate.toISOString().split('T')[0]}\n`;
        output += `Type: ${workout.sessionType}\n`;
        if (workout.durationMinutes) output += `Duration: ${workout.durationMinutes} min\n`;
        if (workout.distanceKm) output += `Distance: ${workout.distanceKm} km\n`;
        if (workout.avgPaceMinKm) output += `Pace: ${workout.avgPaceMinKm} min/km\n`;
        if (workout.caloriesBurned) output += `Calories: ${workout.caloriesBurned}\n`;
        if (workout.rpe) output += `RPE: ${workout.rpe}/10`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in fitness_log_workout:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get workout history
  server.tool(
    'fitness_get_workouts',
    'Get workout history',
    {
      sessionType: z.enum(['STRENGTH', 'RUNNING', 'CARDIO', 'HIIT', 'FLEXIBILITY', 'REST', 'CROSS_TRAINING']).optional().describe('Filter by type'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results'),
    },
    async (params) => {
      try {
        const workouts = await getWorkoutLogs({
          sessionType: params.sessionType as SessionType | undefined,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          limit: params.limit ?? 10,
        });

        if (workouts.length === 0) {
          return { content: [{ type: 'text', text: 'No workouts found.' }] };
        }

        const lines = workouts.map(w => {
          const dateStr = w.logDate.toISOString().split('T')[0];
          let line = `${dateStr}: ${w.name ?? w.sessionType}`;
          if (w.durationMinutes) line += ` (${w.durationMinutes}min)`;
          if (w.distanceKm) line += ` ${w.distanceKm}km`;
          return line;
        });

        return {
          content: [{ type: 'text', text: `Workout History (${workouts.length}):\n\n${lines.join('\n')}` }]
        };
      } catch (error) {
        console.error('Error in fitness_get_workouts:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Log body measurement
  server.tool(
    'fitness_log_body_measurement',
    'Log body weight, body fat, resting HR, or VO2max',
    {
      date: z.string().describe('Measurement date (YYYY-MM-DD)'),
      weightKg: z.number().optional().describe('Body weight in kg'),
      bodyFatPercent: z.number().optional().describe('Body fat percentage'),
      muscleMassKg: z.number().optional().describe('Muscle mass in kg'),
      restingHR: z.number().int().optional().describe('Resting heart rate in bpm'),
      vo2maxEstimate: z.number().optional().describe('Estimated VO2max'),
      source: z.enum(['MANUAL', 'APPLE_HEALTH', 'APP_SCREENSHOT']).optional().describe('Data source'),
      notes: z.string().optional().describe('Notes'),
    },
    async (params) => {
      try {
        const measurement = await upsertBodyMeasurement({
          measureDate: new Date(params.date),
          weightKg: params.weightKg,
          bodyFatPercent: params.bodyFatPercent,
          muscleMassKg: params.muscleMassKg,
          restingHR: params.restingHR,
          vo2maxEstimate: params.vo2maxEstimate,
          source: params.source as MeasurementSource | undefined,
          notes: params.notes,
        });

        let output = `Body measurement logged for ${measurement.measureDate.toISOString().split('T')[0]}\n\n`;
        if (measurement.weightKg) output += `Weight: ${measurement.weightKg} kg\n`;
        if (measurement.bodyFatPercent) output += `Body Fat: ${measurement.bodyFatPercent}%\n`;
        if (measurement.muscleMassKg) output += `Muscle Mass: ${measurement.muscleMassKg} kg\n`;
        if (measurement.restingHR) output += `Resting HR: ${measurement.restingHR} bpm\n`;
        if (measurement.vo2maxEstimate) output += `VO2max: ${measurement.vo2maxEstimate}`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in fitness_log_body_measurement:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get body measurements
  server.tool(
    'fitness_get_body_measurements',
    'Get body measurement history',
    {
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results'),
    },
    async (params) => {
      try {
        const measurements = await getBodyMeasurements({
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          limit: params.limit ?? 10,
        });

        if (measurements.length === 0) {
          return { content: [{ type: 'text', text: 'No body measurements found.' }] };
        }

        const lines = measurements.map(m => {
          const dateStr = m.measureDate.toISOString().split('T')[0];
          let line = `${dateStr}:`;
          if (m.weightKg) line += ` ${m.weightKg}kg`;
          if (m.bodyFatPercent) line += ` | ${m.bodyFatPercent}% BF`;
          if (m.restingHR) line += ` | ${m.restingHR}bpm`;
          if (m.vo2maxEstimate) line += ` | VO2: ${m.vo2maxEstimate}`;
          return line;
        });

        return {
          content: [{ type: 'text', text: `Body Measurements (${measurements.length}):\n\n${lines.join('\n')}` }]
        };
      } catch (error) {
        console.error('Error in fitness_get_body_measurements:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Log strength PR
  server.tool(
    'fitness_log_strength_pr',
    'Log a new strength personal record',
    {
      exercise: z.string().describe('Exercise name (e.g., "Squat", "Bench Press")'),
      date: z.string().describe('PR date (YYYY-MM-DD)'),
      weightKg: z.number().describe('Weight lifted in kg'),
      reps: z.number().int().min(1).optional().describe('Number of reps (default: 1)'),
      notes: z.string().optional().describe('Notes'),
    },
    async (params) => {
      try {
        const pr = await createStrengthPR({
          exercise: params.exercise,
          prDate: new Date(params.date),
          weightKg: params.weightKg,
          reps: params.reps,
          notes: params.notes,
        });

        return {
          content: [{
            type: 'text',
            text: `New PR logged!\n\n` +
                  `Exercise: ${pr.exercise}\n` +
                  `Weight: ${pr.weightKg} kg x ${pr.reps} rep${pr.reps === 1 ? '' : 's'}\n` +
                  (pr.oneRepMaxEst ? `Estimated 1RM: ${pr.oneRepMaxEst} kg` : '')
          }]
        };
      } catch (error) {
        console.error('Error in fitness_log_strength_pr:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get strength PRs
  server.tool(
    'fitness_get_strength_prs',
    'Get strength PR history',
    {
      exercise: z.string().optional().describe('Filter by exercise name'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results'),
    },
    async (params) => {
      try {
        const prs = await getStrengthPRs({
          exercise: params.exercise,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          limit: params.limit ?? 20,
        });

        if (prs.length === 0) {
          return { content: [{ type: 'text', text: 'No strength PRs found.' }] };
        }

        const lines = prs.map(pr => {
          const dateStr = pr.prDate.toISOString().split('T')[0];
          return `${dateStr}: ${pr.exercise} - ${pr.weightKg}kg x ${pr.reps}${pr.oneRepMaxEst ? ` (1RM: ${pr.oneRepMaxEst}kg)` : ''}`;
        });

        return {
          content: [{ type: 'text', text: `Strength PRs (${prs.length}):\n\n${lines.join('\n')}` }]
        };
      } catch (error) {
        console.error('Error in fitness_get_strength_prs:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get overall progress summary
  server.tool(
    'fitness_get_progress_summary',
    'Get an overview of all fitness goal progress and activity',
    {},
    async () => {
      try {
        const summary = await getProgressSummary();

        let output = `Fitness Progress Summary\n\n`;

        // Active program
        if (summary.activeProgram) {
          output += `Active Program: ${summary.activeProgram.name}\n`;
          output += `   Week ${summary.activeProgram.currentWeek}/${summary.activeProgram.totalWeeks}`;
          if (summary.activeProgram.currentPhase) {
            output += ` - ${summary.activeProgram.currentPhase}`;
          }
          output += '\n\n';
        }

        // This week stats
        output += `This Week:\n`;
        output += `   Workouts: ${summary.thisWeekWorkouts}\n`;
        output += `   Nutrition days logged: ${summary.thisWeekNutritionDays}\n\n`;

        // Latest measurement
        if (summary.recentMeasurement) {
          output += `Latest Measurement (${summary.recentMeasurement.measureDate.toISOString().split('T')[0]}):\n`;
          if (summary.recentMeasurement.weightKg) output += `   Weight: ${summary.recentMeasurement.weightKg} kg\n`;
          if (summary.recentMeasurement.bodyFatPercent) output += `   Body Fat: ${summary.recentMeasurement.bodyFatPercent}%\n`;
          if (summary.recentMeasurement.vo2maxEstimate) output += `   VO2max: ${summary.recentMeasurement.vo2maxEstimate}\n`;
          output += '\n';
        }

        // Goals
        if (summary.goals.length > 0) {
          output += `Goals:\n`;
          for (const goal of summary.goals) {
            const status = goal.isCompleted ? 'COMPLETED' : (goal.isOnTrack ? 'ON_TRACK' : 'BEHIND');
            output += `   [${status}] ${goal.goalName}: ${goal.progressPercent.toFixed(0)}% complete\n`;
          }
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in fitness_get_progress_summary:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get weekly summary
  server.tool(
    'fitness_get_weekly_summary',
    'Get detailed summary for a specific week',
    {
      weekStartDate: z.string().optional().describe('Week start date (YYYY-MM-DD) - defaults to current week'),
    },
    async (params) => {
      try {
        const summary = await getWeeklySummary(
          params.weekStartDate ? new Date(params.weekStartDate) : undefined
        );

        let output = `Weekly Summary\n`;
        output += `${summary.weekStart.toISOString().split('T')[0]} to ${summary.weekEnd.toISOString().split('T')[0]}\n\n`;

        // Workouts
        output += `Workouts: ${summary.workouts.count}\n`;
        if (summary.workouts.totalDurationMinutes > 0) {
          output += `   Total Time: ${summary.workouts.totalDurationMinutes} min\n`;
        }
        if (summary.workouts.totalDistanceKm > 0) {
          output += `   Total Distance: ${summary.workouts.totalDistanceKm.toFixed(1)} km\n`;
        }
        if (Object.keys(summary.workouts.byType).length > 0) {
          output += `   By Type: ${Object.entries(summary.workouts.byType).map(([t, c]) => `${t}: ${c}`).join(', ')}\n`;
        }
        output += '\n';

        // Completion rate
        if (summary.scheduledSessions.length > 0) {
          output += `Schedule Completion: ${summary.completionRate}% (${summary.workouts.count}/${summary.scheduledSessions.length})\n\n`;
        }

        // Nutrition
        output += `Nutrition: ${summary.nutrition.daysLogged} days logged\n`;
        if (summary.nutrition.avgCalories) output += `   Avg Calories: ${summary.nutrition.avgCalories}\n`;
        if (summary.nutrition.avgProtein) output += `   Avg Protein: ${summary.nutrition.avgProtein}g\n`;
        output += '\n';

        // Body measurement
        if (summary.bodyMeasurement) {
          output += `Body: `;
          if (summary.bodyMeasurement.weightKg) output += `${summary.bodyMeasurement.weightKg}kg`;
          output += '\n\n';
        }

        // PRs
        if (summary.strengthPRs.length > 0) {
          output += `PRs This Week:\n`;
          for (const pr of summary.strengthPRs) {
            output += `   ${pr.exercise}: ${pr.weightKg}kg x ${pr.reps}\n`;
          }
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        console.error('Error in fitness_get_weekly_summary:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );
}
