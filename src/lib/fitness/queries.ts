import { prisma } from "../db";
import { Decimal } from "@prisma/client/runtime/library";
import {
  GoalType,
  GoalDirection,
  ProgramPhase,
  SessionType,
  MeasurementSource,
} from "@prisma/client";
import {
  FitnessGoalResponse,
  GoalProgressLogResponse,
  GoalProgressSummary,
  TrainingProgramResponse,
  ProgramPhaseBlockResponse,
  SessionTemplateResponse,
  CurrentWeekSchedule,
  NutritionDayResponse,
  NutritionSummaryResponse,
  WorkoutLogResponse,
  StrengthPRResponse,
  BodyMeasurementResponse,
  ProgressSummaryResponse,
  WeeklySummaryResponse,
  CreateFitnessGoalInput,
  UpdateFitnessGoalInput,
  CreateTrainingProgramInput,
  CreateProgramPhaseInput,
  CreateSessionTemplateInput,
  UpsertNutritionDayInput,
  CreateWorkoutLogInput,
  CreateStrengthPRInput,
  UpsertBodyMeasurementInput,
  FitnessGoalFilters,
  WorkoutLogFilters,
  NutritionDayFilters,
  BodyMeasurementFilters,
  StrengthPRFilters,
  GoalProgressFilters,
} from "./types";

// ==========================================
// Utility Functions
// ==========================================

function decimalToNumber(value: Decimal | null): number | null {
  return value ? value.toNumber() : null;
}

function parseJsonArray(value: string | null): string[] | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Calculate estimated 1RM using Epley formula: weight * (1 + reps/30)
 */
export function calculateOneRepMax(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100;
}

/**
 * Get the Monday of the week containing the given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday of the week containing the given date
 */
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

// ==========================================
// Goal Operations
// ==========================================

export async function createFitnessGoal(
  input: CreateFitnessGoalInput
): Promise<FitnessGoalResponse> {
  const goal = await prisma.fitnessGoal.create({
    data: {
      name: input.name,
      goalType: input.goalType,
      direction: input.direction ?? GoalDirection.DECREASE,
      targetValue: input.targetValue,
      targetUnit: input.targetUnit,
      startValue: input.startValue,
      currentValue: input.startValue,
      startDate: input.startDate,
      targetDate: input.targetDate,
      notes: input.notes,
    },
  });

  return {
    ...goal,
    targetValue: decimalToNumber(goal.targetValue)!,
    startValue: decimalToNumber(goal.startValue),
    currentValue: decimalToNumber(goal.currentValue),
  };
}

export async function getFitnessGoals(
  filters: FitnessGoalFilters = {}
): Promise<FitnessGoalResponse[]> {
  const goals = await prisma.fitnessGoal.findMany({
    where: {
      ...(filters.goalType && { goalType: filters.goalType }),
      ...(filters.includeCompleted === false && { isCompleted: false }),
    },
    orderBy: [{ isCompleted: "asc" }, { createdAt: "desc" }],
    take: filters.limit,
  });

  return goals.map((g) => ({
    ...g,
    targetValue: decimalToNumber(g.targetValue)!,
    startValue: decimalToNumber(g.startValue),
    currentValue: decimalToNumber(g.currentValue),
  }));
}

export async function getFitnessGoalById(
  id: string
): Promise<FitnessGoalResponse | null> {
  const goal = await prisma.fitnessGoal.findUnique({
    where: { id },
  });

  if (!goal) return null;

  return {
    ...goal,
    targetValue: decimalToNumber(goal.targetValue)!,
    startValue: decimalToNumber(goal.startValue),
    currentValue: decimalToNumber(goal.currentValue),
  };
}

export async function updateFitnessGoal(
  id: string,
  input: UpdateFitnessGoalInput
): Promise<FitnessGoalResponse> {
  const goal = await prisma.fitnessGoal.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.targetValue !== undefined && { targetValue: input.targetValue }),
      ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
      ...(input.currentValue !== undefined && { currentValue: input.currentValue }),
      ...(input.isCompleted !== undefined && {
        isCompleted: input.isCompleted,
        completedAt: input.isCompleted ? new Date() : null,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });

  return {
    ...goal,
    targetValue: decimalToNumber(goal.targetValue)!,
    startValue: decimalToNumber(goal.startValue),
    currentValue: decimalToNumber(goal.currentValue),
  };
}

export async function deleteFitnessGoal(id: string): Promise<void> {
  await prisma.fitnessGoal.delete({ where: { id } });
}

export async function logGoalProgress(
  goalId: string,
  date: Date,
  value: number,
  source: MeasurementSource = MeasurementSource.MANUAL,
  notes?: string
): Promise<GoalProgressLogResponse> {
  // Create progress log and update goal's current value
  const [log] = await prisma.$transaction([
    prisma.goalProgressLog.create({
      data: {
        goalId,
        logDate: date,
        value,
        source,
        notes,
      },
    }),
    prisma.fitnessGoal.update({
      where: { id: goalId },
      data: { currentValue: value },
    }),
  ]);

  return {
    ...log,
    value: decimalToNumber(log.value)!,
  };
}

export async function getGoalProgress(
  goalId: string,
  filters: GoalProgressFilters = {}
): Promise<GoalProgressLogResponse[]> {
  const logs = await prisma.goalProgressLog.findMany({
    where: {
      goalId,
      ...(filters.startDate && { logDate: { gte: filters.startDate } }),
      ...(filters.endDate && { logDate: { lte: filters.endDate } }),
    },
    orderBy: { logDate: "desc" },
    take: filters.limit,
  });

  return logs.map((l) => ({
    ...l,
    value: decimalToNumber(l.value)!,
  }));
}

export async function calculateGoalProgress(
  goalId: string
): Promise<GoalProgressSummary | null> {
  const goal = await prisma.fitnessGoal.findUnique({
    where: { id: goalId },
    include: {
      progressLogs: {
        orderBy: { logDate: "desc" },
        take: 1,
      },
    },
  });

  if (!goal) return null;

  const startValue = decimalToNumber(goal.startValue) ?? decimalToNumber(goal.currentValue) ?? 0;
  const currentValue = decimalToNumber(goal.currentValue) ?? startValue;
  const targetValue = decimalToNumber(goal.targetValue)!;

  let progressPercent: number;
  let remainingToTarget: number;

  if (goal.direction === GoalDirection.DECREASE) {
    const totalChange = startValue - targetValue;
    const actualChange = startValue - currentValue;
    progressPercent = totalChange > 0 ? (actualChange / totalChange) * 100 : 0;
    remainingToTarget = currentValue - targetValue;
  } else if (goal.direction === GoalDirection.INCREASE) {
    const totalChange = targetValue - startValue;
    const actualChange = currentValue - startValue;
    progressPercent = totalChange > 0 ? (actualChange / totalChange) * 100 : 0;
    remainingToTarget = targetValue - currentValue;
  } else {
    // MAINTAIN: check if within 2% tolerance
    const tolerance = Math.abs(targetValue * 0.02);
    progressPercent = Math.abs(currentValue - targetValue) <= tolerance ? 100 : 0;
    remainingToTarget = Math.abs(currentValue - targetValue);
  }

  progressPercent = Math.min(100, Math.max(0, progressPercent));

  // Calculate if on track based on time elapsed
  let isOnTrack = true;
  let daysRemaining: number | null = null;

  if (goal.targetDate) {
    const now = new Date();
    const totalDays = Math.ceil(
      (goal.targetDate.getTime() - goal.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysElapsed = Math.ceil(
      (now.getTime() - goal.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    daysRemaining = Math.max(
      0,
      Math.ceil((goal.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
    isOnTrack = progressPercent >= expectedProgress * 0.9; // Within 90% of expected
  }

  return {
    goalId: goal.id,
    goalName: goal.name,
    goalType: goal.goalType,
    direction: goal.direction,
    startValue,
    currentValue,
    targetValue,
    targetUnit: goal.targetUnit,
    progressPercent: Math.round(progressPercent * 10) / 10,
    remainingToTarget: Math.round(remainingToTarget * 100) / 100,
    isOnTrack,
    isCompleted: goal.isCompleted || progressPercent >= 100,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    daysRemaining,
    latestLogDate: goal.progressLogs[0]?.logDate ?? null,
  };
}

// ==========================================
// Training Program Operations
// ==========================================

export async function createTrainingProgram(
  input: CreateTrainingProgramInput
): Promise<TrainingProgramResponse> {
  const program = await prisma.trainingProgram.create({
    data: {
      name: input.name,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes,
    },
  });

  return program;
}

export async function getTrainingPrograms(
  activeOnly: boolean = false
): Promise<TrainingProgramResponse[]> {
  const programs = await prisma.trainingProgram.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: {
      phases: {
        orderBy: { sortOrder: "asc" },
        include: {
          sessionTemplates: {
            orderBy: { dayOfWeek: "asc" },
          },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return programs.map((p) => ({
    ...p,
    phases: p.phases.map((phase) => ({
      ...phase,
      focusAreas: parseJsonArray(phase.focusAreas),
      sessionTemplates: phase.sessionTemplates.map((s) => ({
        ...s,
        targetDistance: decimalToNumber(s.targetDistance),
      })),
    })),
  }));
}

export async function updateTrainingProgram(
  id: string,
  data: Partial<CreateTrainingProgramInput> & { isActive?: boolean }
): Promise<TrainingProgramResponse> {
  // If setting as active, deactivate all others first
  if (data.isActive) {
    await prisma.trainingProgram.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }

  const program = await prisma.trainingProgram.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  return program;
}

export async function deleteTrainingProgram(id: string): Promise<void> {
  await prisma.trainingProgram.delete({ where: { id } });
}

export async function addProgramPhase(
  input: CreateProgramPhaseInput
): Promise<ProgramPhaseBlockResponse> {
  // Get max sort order for this program
  const maxOrder = await prisma.programPhaseBlock.findFirst({
    where: { programId: input.programId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const phase = await prisma.programPhaseBlock.create({
    data: {
      programId: input.programId,
      name: input.name,
      phaseType: input.phaseType,
      weekNumber: input.weekNumber,
      durationWeeks: input.durationWeeks ?? 1,
      sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      focusAreas: input.focusAreas ? JSON.stringify(input.focusAreas) : null,
      notes: input.notes,
    },
  });

  return {
    ...phase,
    focusAreas: parseJsonArray(phase.focusAreas),
  };
}

export async function addSessionTemplate(
  input: CreateSessionTemplateInput
): Promise<SessionTemplateResponse> {
  const session = await prisma.sessionTemplate.create({
    data: {
      phaseBlockId: input.phaseBlockId,
      dayOfWeek: input.dayOfWeek,
      sessionType: input.sessionType,
      name: input.name,
      description: input.description,
      targetDuration: input.targetDuration,
      targetDistance: input.targetDistance,
      targetIntensity: input.targetIntensity,
      notes: input.notes,
    },
  });

  return {
    ...session,
    targetDistance: decimalToNumber(session.targetDistance),
  };
}

export async function getActiveProgram(): Promise<CurrentWeekSchedule | null> {
  const program = await prisma.trainingProgram.findFirst({
    where: { isActive: true },
    include: {
      phases: {
        orderBy: { sortOrder: "asc" },
        include: {
          sessionTemplates: {
            orderBy: { dayOfWeek: "asc" },
          },
        },
      },
    },
  });

  if (!program) return null;

  // Calculate current week based on start date
  let currentWeek = 1;
  if (program.startDate) {
    const now = new Date();
    const diffTime = now.getTime() - program.startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    currentWeek = Math.max(1, Math.floor(diffDays / 7) + 1);
  }

  // Find current phase based on week number
  let currentPhase: ProgramPhaseBlockResponse | null = null;
  for (const phase of program.phases) {
    const phaseEndWeek = phase.weekNumber + phase.durationWeeks - 1;
    if (currentWeek >= phase.weekNumber && currentWeek <= phaseEndWeek) {
      currentPhase = {
        ...phase,
        focusAreas: parseJsonArray(phase.focusAreas),
        sessionTemplates: phase.sessionTemplates.map((s) => ({
          ...s,
          targetDistance: decimalToNumber(s.targetDistance),
        })),
      };
      break;
    }
  }

  return {
    program: {
      ...program,
      phases: program.phases.map((p) => ({
        ...p,
        focusAreas: parseJsonArray(p.focusAreas),
        sessionTemplates: p.sessionTemplates.map((s) => ({
          ...s,
          targetDistance: decimalToNumber(s.targetDistance),
        })),
      })),
    },
    currentWeek,
    currentPhase,
    weekSessions: currentPhase?.sessionTemplates ?? [],
  };
}

// ==========================================
// Nutrition Operations
// ==========================================

export async function upsertNutritionDay(
  input: UpsertNutritionDayInput
): Promise<NutritionDayResponse> {
  const day = await prisma.nutritionDay.upsert({
    where: { date: input.date },
    update: {
      ...(input.caloriesBudget !== undefined && { caloriesBudget: input.caloriesBudget }),
      ...(input.caloriesActual !== undefined && { caloriesActual: input.caloriesActual }),
      ...(input.proteinBudget !== undefined && { proteinBudget: input.proteinBudget }),
      ...(input.proteinActual !== undefined && { proteinActual: input.proteinActual }),
      ...(input.carbsBudget !== undefined && { carbsBudget: input.carbsBudget }),
      ...(input.carbsActual !== undefined && { carbsActual: input.carbsActual }),
      ...(input.fatBudget !== undefined && { fatBudget: input.fatBudget }),
      ...(input.fatActual !== undefined && { fatActual: input.fatActual }),
      ...(input.source !== undefined && { source: input.source }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
    create: {
      date: input.date,
      caloriesBudget: input.caloriesBudget,
      caloriesActual: input.caloriesActual,
      proteinBudget: input.proteinBudget,
      proteinActual: input.proteinActual,
      carbsBudget: input.carbsBudget,
      carbsActual: input.carbsActual,
      fatBudget: input.fatBudget,
      fatActual: input.fatActual,
      source: input.source ?? MeasurementSource.MANUAL,
      notes: input.notes,
    },
  });

  return {
    ...day,
    caloriesVariance:
      day.caloriesActual && day.caloriesBudget
        ? day.caloriesActual - day.caloriesBudget
        : null,
    proteinVariance:
      day.proteinActual && day.proteinBudget
        ? day.proteinActual - day.proteinBudget
        : null,
    carbsVariance:
      day.carbsActual && day.carbsBudget ? day.carbsActual - day.carbsBudget : null,
    fatVariance:
      day.fatActual && day.fatBudget ? day.fatActual - day.fatBudget : null,
  };
}

export async function getNutritionDays(
  filters: NutritionDayFilters = {}
): Promise<NutritionDayResponse[]> {
  const days = await prisma.nutritionDay.findMany({
    where: {
      ...(filters.startDate && { date: { gte: filters.startDate } }),
      ...(filters.endDate && { date: { lte: filters.endDate } }),
    },
    orderBy: { date: "desc" },
    take: filters.limit,
  });

  return days.map((d) => ({
    ...d,
    caloriesVariance:
      d.caloriesActual && d.caloriesBudget ? d.caloriesActual - d.caloriesBudget : null,
    proteinVariance:
      d.proteinActual && d.proteinBudget ? d.proteinActual - d.proteinBudget : null,
    carbsVariance: d.carbsActual && d.carbsBudget ? d.carbsActual - d.carbsBudget : null,
    fatVariance: d.fatActual && d.fatBudget ? d.fatActual - d.fatBudget : null,
  }));
}

export async function getNutritionSummary(
  period: "WEEKLY" | "MONTHLY",
  startDate?: Date
): Promise<NutritionSummaryResponse> {
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;

  if (period === "WEEKLY") {
    periodStart = startDate ? getWeekStart(startDate) : getWeekStart(now);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6);
  } else {
    periodStart = startDate
      ? new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
  }

  const days = await prisma.nutritionDay.findMany({
    where: {
      date: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  const daysLogged = days.length;

  // Calculate averages and totals
  const totals = {
    caloriesBudget: 0,
    caloriesActual: 0,
    proteinBudget: 0,
    proteinActual: 0,
    carbsBudget: 0,
    carbsActual: 0,
    fatBudget: 0,
    fatActual: 0,
  };
  let budgetDays = 0;
  let caloriesOnTarget = 0;
  let proteinOnTarget = 0;

  for (const day of days) {
    if (day.caloriesBudget) {
      totals.caloriesBudget += day.caloriesBudget;
      budgetDays++;
    }
    if (day.caloriesActual) totals.caloriesActual += day.caloriesActual;
    if (day.proteinBudget) totals.proteinBudget += day.proteinBudget;
    if (day.proteinActual) totals.proteinActual += day.proteinActual;
    if (day.carbsBudget) totals.carbsBudget += day.carbsBudget;
    if (day.carbsActual) totals.carbsActual += day.carbsActual;
    if (day.fatBudget) totals.fatBudget += day.fatBudget;
    if (day.fatActual) totals.fatActual += day.fatActual;

    // Check if within 10% of budget
    if (day.caloriesBudget && day.caloriesActual) {
      const variance = Math.abs(day.caloriesActual - day.caloriesBudget) / day.caloriesBudget;
      if (variance <= 0.1) caloriesOnTarget++;
    }
    if (day.proteinBudget && day.proteinActual) {
      const variance = Math.abs(day.proteinActual - day.proteinBudget) / day.proteinBudget;
      if (variance <= 0.1) proteinOnTarget++;
    }
  }

  return {
    period,
    startDate: periodStart,
    endDate: periodEnd,
    daysLogged,
    averages: {
      caloriesBudget: budgetDays > 0 ? Math.round(totals.caloriesBudget / budgetDays) : null,
      caloriesActual: daysLogged > 0 ? Math.round(totals.caloriesActual / daysLogged) : null,
      proteinBudget: budgetDays > 0 ? Math.round(totals.proteinBudget / budgetDays) : null,
      proteinActual: daysLogged > 0 ? Math.round(totals.proteinActual / daysLogged) : null,
      carbsBudget: budgetDays > 0 ? Math.round(totals.carbsBudget / budgetDays) : null,
      carbsActual: daysLogged > 0 ? Math.round(totals.carbsActual / daysLogged) : null,
      fatBudget: budgetDays > 0 ? Math.round(totals.fatBudget / budgetDays) : null,
      fatActual: daysLogged > 0 ? Math.round(totals.fatActual / daysLogged) : null,
    },
    totals: {
      caloriesActual: totals.caloriesActual,
      proteinActual: totals.proteinActual,
      carbsActual: totals.carbsActual,
      fatActual: totals.fatActual,
    },
    compliance: {
      caloriesOnTarget: daysLogged > 0 ? Math.round((caloriesOnTarget / daysLogged) * 100) : 0,
      proteinOnTarget: daysLogged > 0 ? Math.round((proteinOnTarget / daysLogged) * 100) : 0,
    },
  };
}

// ==========================================
// Workout & Measurement Operations
// ==========================================

export async function createWorkoutLog(
  input: CreateWorkoutLogInput
): Promise<WorkoutLogResponse> {
  const workout = await prisma.workoutLog.create({
    data: {
      logDate: input.logDate,
      sessionType: input.sessionType,
      name: input.name,
      durationMinutes: input.durationMinutes,
      distanceKm: input.distanceKm,
      avgPaceMinKm: input.avgPaceMinKm,
      caloriesBurned: input.caloriesBurned,
      avgHeartRate: input.avgHeartRate,
      maxHeartRate: input.maxHeartRate,
      rpe: input.rpe,
      source: input.source ?? MeasurementSource.MANUAL,
      notes: input.notes,
    },
  });

  return {
    ...workout,
    distanceKm: decimalToNumber(workout.distanceKm),
    avgPaceMinKm: decimalToNumber(workout.avgPaceMinKm),
  };
}

export async function getWorkoutLogs(
  filters: WorkoutLogFilters = {}
): Promise<WorkoutLogResponse[]> {
  const workouts = await prisma.workoutLog.findMany({
    where: {
      ...(filters.sessionType && { sessionType: filters.sessionType }),
      ...(filters.startDate && { logDate: { gte: filters.startDate } }),
      ...(filters.endDate && { logDate: { lte: filters.endDate } }),
    },
    include: {
      strengthPRs: true,
    },
    orderBy: { logDate: "desc" },
    take: filters.limit,
  });

  return workouts.map((w) => ({
    ...w,
    distanceKm: decimalToNumber(w.distanceKm),
    avgPaceMinKm: decimalToNumber(w.avgPaceMinKm),
    strengthPRs: w.strengthPRs.map((pr) => ({
      ...pr,
      weightKg: decimalToNumber(pr.weightKg)!,
      oneRepMaxEst: decimalToNumber(pr.oneRepMaxEst),
    })),
  }));
}

export async function upsertBodyMeasurement(
  input: UpsertBodyMeasurementInput
): Promise<BodyMeasurementResponse> {
  const measurement = await prisma.bodyMeasurement.upsert({
    where: { measureDate: input.measureDate },
    update: {
      ...(input.weightKg !== undefined && { weightKg: input.weightKg }),
      ...(input.bodyFatPercent !== undefined && { bodyFatPercent: input.bodyFatPercent }),
      ...(input.muscleMassKg !== undefined && { muscleMassKg: input.muscleMassKg }),
      ...(input.restingHR !== undefined && { restingHR: input.restingHR }),
      ...(input.vo2maxEstimate !== undefined && { vo2maxEstimate: input.vo2maxEstimate }),
      ...(input.source !== undefined && { source: input.source }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
    create: {
      measureDate: input.measureDate,
      weightKg: input.weightKg,
      bodyFatPercent: input.bodyFatPercent,
      muscleMassKg: input.muscleMassKg,
      restingHR: input.restingHR,
      vo2maxEstimate: input.vo2maxEstimate,
      source: input.source ?? MeasurementSource.MANUAL,
      notes: input.notes,
    },
  });

  return {
    ...measurement,
    weightKg: decimalToNumber(measurement.weightKg),
    bodyFatPercent: decimalToNumber(measurement.bodyFatPercent),
    muscleMassKg: decimalToNumber(measurement.muscleMassKg),
    vo2maxEstimate: decimalToNumber(measurement.vo2maxEstimate),
  };
}

export async function getBodyMeasurements(
  filters: BodyMeasurementFilters = {}
): Promise<BodyMeasurementResponse[]> {
  const measurements = await prisma.bodyMeasurement.findMany({
    where: {
      ...(filters.startDate && { measureDate: { gte: filters.startDate } }),
      ...(filters.endDate && { measureDate: { lte: filters.endDate } }),
    },
    orderBy: { measureDate: "desc" },
    take: filters.limit,
  });

  return measurements.map((m) => ({
    ...m,
    weightKg: decimalToNumber(m.weightKg),
    bodyFatPercent: decimalToNumber(m.bodyFatPercent),
    muscleMassKg: decimalToNumber(m.muscleMassKg),
    vo2maxEstimate: decimalToNumber(m.vo2maxEstimate),
  }));
}

export async function createStrengthPR(
  input: CreateStrengthPRInput
): Promise<StrengthPRResponse> {
  const oneRepMaxEst = calculateOneRepMax(input.weightKg, input.reps ?? 1);

  const pr = await prisma.strengthPR.create({
    data: {
      exercise: input.exercise,
      prDate: input.prDate,
      weightKg: input.weightKg,
      reps: input.reps ?? 1,
      oneRepMaxEst,
      workoutLogId: input.workoutLogId,
      notes: input.notes,
    },
  });

  return {
    ...pr,
    weightKg: decimalToNumber(pr.weightKg)!,
    oneRepMaxEst: decimalToNumber(pr.oneRepMaxEst),
  };
}

export async function getStrengthPRs(
  filters: StrengthPRFilters = {}
): Promise<StrengthPRResponse[]> {
  const prs = await prisma.strengthPR.findMany({
    where: {
      ...(filters.exercise && { exercise: { contains: filters.exercise, mode: "insensitive" } }),
      ...(filters.startDate && { prDate: { gte: filters.startDate } }),
      ...(filters.endDate && { prDate: { lte: filters.endDate } }),
    },
    orderBy: { prDate: "desc" },
    take: filters.limit,
  });

  return prs.map((pr) => ({
    ...pr,
    weightKg: decimalToNumber(pr.weightKg)!,
    oneRepMaxEst: decimalToNumber(pr.oneRepMaxEst),
  }));
}

// ==========================================
// Analytics Operations
// ==========================================

export async function getProgressSummary(): Promise<ProgressSummaryResponse> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);

  // Get all active goals with progress
  const goals = await prisma.fitnessGoal.findMany({
    where: { isCompleted: false },
    include: {
      progressLogs: {
        orderBy: { logDate: "desc" },
        take: 1,
      },
    },
  });

  const goalSummaries = await Promise.all(
    goals.map((g) => calculateGoalProgress(g.id))
  );

  // Get active program info
  const activeProgram = await getActiveProgram();

  // Get most recent body measurement
  const recentMeasurement = await prisma.bodyMeasurement.findFirst({
    orderBy: { measureDate: "desc" },
  });

  // Count this week's workouts
  const thisWeekWorkouts = await prisma.workoutLog.count({
    where: {
      logDate: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
  });

  // Count this week's nutrition days
  const thisWeekNutritionDays = await prisma.nutritionDay.count({
    where: {
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
  });

  // Calculate total weeks in program
  let totalWeeks = 0;
  if (activeProgram?.program.phases) {
    for (const phase of activeProgram.program.phases) {
      const endWeek = phase.weekNumber + phase.durationWeeks - 1;
      if (endWeek > totalWeeks) totalWeeks = endWeek;
    }
  }

  return {
    goals: goalSummaries.filter((g): g is GoalProgressSummary => g !== null),
    activeProgram: activeProgram
      ? {
          name: activeProgram.program.name,
          currentWeek: activeProgram.currentWeek,
          totalWeeks,
          currentPhase: activeProgram.currentPhase?.name ?? null,
        }
      : null,
    recentMeasurement: recentMeasurement
      ? {
          ...recentMeasurement,
          weightKg: decimalToNumber(recentMeasurement.weightKg),
          bodyFatPercent: decimalToNumber(recentMeasurement.bodyFatPercent),
          muscleMassKg: decimalToNumber(recentMeasurement.muscleMassKg),
          vo2maxEstimate: decimalToNumber(recentMeasurement.vo2maxEstimate),
        }
      : null,
    thisWeekWorkouts,
    thisWeekNutritionDays,
  };
}

export async function getWeeklySummary(weekStartDate?: Date): Promise<WeeklySummaryResponse> {
  const weekStart = weekStartDate ? getWeekStart(weekStartDate) : getWeekStart(new Date());
  const weekEnd = getWeekEnd(weekStart);

  // Get workouts for the week
  const workouts = await prisma.workoutLog.findMany({
    where: {
      logDate: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      strengthPRs: true,
    },
  });

  // Aggregate workout stats
  const workoutStats = {
    count: workouts.length,
    totalDurationMinutes: 0,
    totalDistanceKm: 0,
    byType: {} as Record<SessionType, number>,
  };

  for (const w of workouts) {
    workoutStats.totalDurationMinutes += w.durationMinutes ?? 0;
    workoutStats.totalDistanceKm += decimalToNumber(w.distanceKm) ?? 0;
    workoutStats.byType[w.sessionType] = (workoutStats.byType[w.sessionType] ?? 0) + 1;
  }

  // Get nutrition for the week
  const nutritionDays = await prisma.nutritionDay.findMany({
    where: {
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
  });

  const nutritionStats = {
    daysLogged: nutritionDays.length,
    avgCalories: null as number | null,
    avgProtein: null as number | null,
  };

  if (nutritionDays.length > 0) {
    const totalCals = nutritionDays.reduce((sum, d) => sum + (d.caloriesActual ?? 0), 0);
    const totalProtein = nutritionDays.reduce((sum, d) => sum + (d.proteinActual ?? 0), 0);
    nutritionStats.avgCalories = Math.round(totalCals / nutritionDays.length);
    nutritionStats.avgProtein = Math.round(totalProtein / nutritionDays.length);
  }

  // Get body measurement for the week
  const bodyMeasurement = await prisma.bodyMeasurement.findFirst({
    where: {
      measureDate: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    orderBy: { measureDate: "desc" },
  });

  // Get all PRs for the week
  const allPRs = workouts.flatMap((w) =>
    w.strengthPRs.map((pr) => ({
      ...pr,
      weightKg: decimalToNumber(pr.weightKg)!,
      oneRepMaxEst: decimalToNumber(pr.oneRepMaxEst),
    }))
  );

  // Get scheduled sessions for this week
  const activeProgram = await getActiveProgram();
  const scheduledSessions = activeProgram?.weekSessions ?? [];

  // Calculate completion rate
  const completionRate =
    scheduledSessions.length > 0
      ? Math.round((workoutStats.count / scheduledSessions.length) * 100)
      : 0;

  return {
    weekStart,
    weekEnd,
    workouts: workoutStats,
    nutrition: nutritionStats,
    bodyMeasurement: bodyMeasurement
      ? {
          ...bodyMeasurement,
          weightKg: decimalToNumber(bodyMeasurement.weightKg),
          bodyFatPercent: decimalToNumber(bodyMeasurement.bodyFatPercent),
          muscleMassKg: decimalToNumber(bodyMeasurement.muscleMassKg),
          vo2maxEstimate: decimalToNumber(bodyMeasurement.vo2maxEstimate),
        }
      : null,
    strengthPRs: allPRs,
    scheduledSessions,
    completionRate,
  };
}
