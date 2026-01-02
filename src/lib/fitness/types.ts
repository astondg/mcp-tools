import {
  GoalType,
  GoalDirection,
  ProgramPhase,
  SessionType,
  MeasurementSource,
} from "@prisma/client";

// Re-export enums for convenience
export { GoalType, GoalDirection, ProgramPhase, SessionType, MeasurementSource };

// ==========================================
// Goal Types
// ==========================================

export interface FitnessGoalResponse {
  id: string;
  name: string;
  goalType: GoalType;
  direction: GoalDirection;
  targetValue: number;
  targetUnit: string;
  startValue: number | null;
  currentValue: number | null;
  startDate: Date;
  targetDate: Date | null;
  isCompleted: boolean;
  completedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalProgressLogResponse {
  id: string;
  goalId: string;
  logDate: Date;
  value: number;
  source: MeasurementSource;
  notes: string | null;
  createdAt: Date;
}

export interface GoalProgressSummary {
  goalId: string;
  goalName: string;
  goalType: GoalType;
  direction: GoalDirection;
  startValue: number;
  currentValue: number;
  targetValue: number;
  targetUnit: string;
  progressPercent: number;
  remainingToTarget: number;
  isOnTrack: boolean;
  isCompleted: boolean;
  startDate: Date;
  targetDate: Date | null;
  daysRemaining: number | null;
  latestLogDate: Date | null;
}

// ==========================================
// Training Program Types
// ==========================================

export interface TrainingProgramResponse {
  id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  phases?: ProgramPhaseBlockResponse[];
}

export interface ProgramPhaseBlockResponse {
  id: string;
  programId: string;
  name: string;
  phaseType: ProgramPhase;
  weekNumber: number;
  durationWeeks: number;
  sortOrder: number;
  focusAreas: string[] | null;
  notes: string | null;
  createdAt: Date;
  sessionTemplates?: SessionTemplateResponse[];
}

export interface SessionTemplateResponse {
  id: string;
  phaseBlockId: string;
  dayOfWeek: number;
  sessionType: SessionType;
  name: string;
  description: string | null;
  targetDuration: number | null;
  targetDistance: number | null;
  targetIntensity: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface CurrentWeekSchedule {
  program: TrainingProgramResponse;
  currentWeek: number;
  currentPhase: ProgramPhaseBlockResponse | null;
  weekSessions: SessionTemplateResponse[];
}

// ==========================================
// Nutrition Types
// ==========================================

export interface NutritionDayResponse {
  id: string;
  date: Date;
  caloriesBudget: number | null;
  caloriesActual: number | null;
  proteinBudget: number | null;
  proteinActual: number | null;
  carbsBudget: number | null;
  carbsActual: number | null;
  fatBudget: number | null;
  fatActual: number | null;
  source: MeasurementSource;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Computed fields
  caloriesVariance?: number | null;
  proteinVariance?: number | null;
  carbsVariance?: number | null;
  fatVariance?: number | null;
}

export interface NutritionSummaryResponse {
  period: "WEEKLY" | "MONTHLY";
  startDate: Date;
  endDate: Date;
  daysLogged: number;
  averages: {
    caloriesBudget: number | null;
    caloriesActual: number | null;
    proteinBudget: number | null;
    proteinActual: number | null;
    carbsBudget: number | null;
    carbsActual: number | null;
    fatBudget: number | null;
    fatActual: number | null;
  };
  totals: {
    caloriesActual: number;
    proteinActual: number;
    carbsActual: number;
    fatActual: number;
  };
  compliance: {
    caloriesOnTarget: number; // Percentage of days within 10% of budget
    proteinOnTarget: number;
  };
}

// ==========================================
// Workout & Measurement Types
// ==========================================

export interface WorkoutLogResponse {
  id: string;
  logDate: Date;
  sessionType: SessionType;
  name: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  avgPaceMinKm: number | null;
  caloriesBurned: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  rpe: number | null;
  source: MeasurementSource;
  notes: string | null;
  createdAt: Date;
  strengthPRs?: StrengthPRResponse[];
}

export interface StrengthPRResponse {
  id: string;
  workoutLogId: string | null;
  exercise: string;
  prDate: Date;
  weightKg: number;
  reps: number;
  oneRepMaxEst: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface BodyMeasurementResponse {
  id: string;
  measureDate: Date;
  weightKg: number | null;
  bodyFatPercent: number | null;
  muscleMassKg: number | null;
  restingHR: number | null;
  vo2maxEstimate: number | null;
  source: MeasurementSource;
  notes: string | null;
  createdAt: Date;
}

// ==========================================
// Analytics Types
// ==========================================

export interface ProgressSummaryResponse {
  goals: GoalProgressSummary[];
  activeProgram: {
    name: string;
    currentWeek: number;
    totalWeeks: number;
    currentPhase: string | null;
  } | null;
  recentMeasurement: BodyMeasurementResponse | null;
  thisWeekWorkouts: number;
  thisWeekNutritionDays: number;
}

export interface WeeklySummaryResponse {
  weekStart: Date;
  weekEnd: Date;
  workouts: {
    count: number;
    totalDurationMinutes: number;
    totalDistanceKm: number;
    byType: Record<SessionType, number>;
  };
  nutrition: {
    daysLogged: number;
    avgCalories: number | null;
    avgProtein: number | null;
  };
  bodyMeasurement: BodyMeasurementResponse | null;
  strengthPRs: StrengthPRResponse[];
  scheduledSessions: SessionTemplateResponse[];
  completionRate: number; // Percentage of scheduled sessions completed
}

// ==========================================
// Input Types for Create/Update
// ==========================================

export interface CreateFitnessGoalInput {
  name: string;
  goalType: GoalType;
  direction?: GoalDirection;
  targetValue: number;
  targetUnit: string;
  startValue?: number;
  startDate: Date;
  targetDate?: Date;
  notes?: string;
}

export interface UpdateFitnessGoalInput {
  name?: string;
  targetValue?: number;
  targetDate?: Date;
  currentValue?: number;
  isCompleted?: boolean;
  notes?: string;
}

export interface CreateTrainingProgramInput {
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}

export interface CreateProgramPhaseInput {
  programId: string;
  name: string;
  phaseType: ProgramPhase;
  weekNumber: number;
  durationWeeks?: number;
  focusAreas?: string[];
  notes?: string;
}

export interface CreateSessionTemplateInput {
  phaseBlockId: string;
  dayOfWeek: number;
  sessionType: SessionType;
  name: string;
  description?: string;
  targetDuration?: number;
  targetDistance?: number;
  targetIntensity?: string;
  notes?: string;
}

export interface UpdateSessionTemplateInput {
  dayOfWeek?: number;
  sessionType?: SessionType;
  name?: string;
  description?: string;
  targetDuration?: number;
  targetDistance?: number;
  targetIntensity?: string;
  notes?: string;
}

export interface BulkSessionInput {
  dayOfWeek: number;
  sessionType: SessionType;
  name: string;
  description?: string;
  targetDuration?: number;
  targetDistance?: number;
  targetIntensity?: string;
  notes?: string;
}

export interface BulkCreateSessionTemplatesInput {
  phaseBlockId: string;
  sessions: BulkSessionInput[];
}

export interface UpsertNutritionDayInput {
  date: Date;
  caloriesBudget?: number;
  caloriesActual?: number;
  proteinBudget?: number;
  proteinActual?: number;
  carbsBudget?: number;
  carbsActual?: number;
  fatBudget?: number;
  fatActual?: number;
  source?: MeasurementSource;
  notes?: string;
}

export interface CreateWorkoutLogInput {
  logDate: Date;
  sessionType: SessionType;
  name?: string;
  durationMinutes?: number;
  distanceKm?: number;
  avgPaceMinKm?: number;
  caloriesBurned?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  rpe?: number;
  source?: MeasurementSource;
  notes?: string;
}

export interface CreateStrengthPRInput {
  exercise: string;
  prDate: Date;
  weightKg: number;
  reps?: number;
  workoutLogId?: string;
  notes?: string;
}

export interface UpsertBodyMeasurementInput {
  measureDate: Date;
  weightKg?: number;
  bodyFatPercent?: number;
  muscleMassKg?: number;
  restingHR?: number;
  vo2maxEstimate?: number;
  source?: MeasurementSource;
  notes?: string;
}

// ==========================================
// Filter Types
// ==========================================

export interface FitnessGoalFilters {
  goalType?: GoalType;
  includeCompleted?: boolean;
  limit?: number;
}

export interface WorkoutLogFilters {
  sessionType?: SessionType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface NutritionDayFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface BodyMeasurementFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface StrengthPRFilters {
  exercise?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface GoalProgressFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}
