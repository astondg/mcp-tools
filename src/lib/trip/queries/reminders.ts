import { prisma } from '@/lib/db';
import { ReminderStatus, ReminderPriority, TaskType } from '@prisma/client';
import type { TripReminderResponse } from '../types';

// Helper functions
function parseJsonField<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function stringifyJsonField<T>(value: T | undefined): string | undefined {
  if (!value) return undefined;
  return JSON.stringify(value);
}

// Add reminder
export async function addReminder(data: {
  tripId: string;
  tripItemId?: string;
  title: string;
  description?: string;
  remindDate: Date;
  priority?: ReminderPriority;
  taskType?: TaskType;
  checklistItems?: Array<{ task: string; completed: boolean }>;
  notes?: string;
}): Promise<TripReminderResponse> {
  const reminder = await prisma.tripReminder.create({
    data: {
      tripId: data.tripId,
      tripItemId: data.tripItemId,
      title: data.title,
      description: data.description,
      remindDate: data.remindDate,
      status: ReminderStatus.PENDING,
      priority: data.priority || ReminderPriority.MEDIUM,
      taskType: data.taskType,
      checklistItems: stringifyJsonField(data.checklistItems),
      notes: data.notes,
    },
  });

  return mapReminderToResponse(reminder);
}

// List reminders with filters
export async function listReminders(
  tripId: string,
  filters?: {
    status?: ReminderStatus | ReminderStatus[];
    priority?: ReminderPriority;
    taskType?: TaskType;
    tripItemId?: string;
    overdueOnly?: boolean;
  }
): Promise<TripReminderResponse[]> {
  const now = new Date();

  const reminders = await prisma.tripReminder.findMany({
    where: {
      tripId,
      ...(filters?.status && {
        status: Array.isArray(filters.status) ? { in: filters.status } : filters.status,
      }),
      ...(filters?.priority && { priority: filters.priority }),
      ...(filters?.taskType && { taskType: filters.taskType }),
      ...(filters?.tripItemId && { tripItemId: filters.tripItemId }),
      ...(filters?.overdueOnly && {
        remindDate: { lt: now },
        status: ReminderStatus.PENDING,
      }),
    },
    orderBy: [{ remindDate: 'asc' }, { priority: 'desc' }],
  });

  return reminders.map(mapReminderToResponse);
}

// Update reminder
export async function updateReminder(
  id: string,
  data: {
    title?: string;
    description?: string;
    remindDate?: Date;
    status?: ReminderStatus;
    priority?: ReminderPriority;
    checklistItems?: Array<{ task: string; completed: boolean }>;
    notes?: string;
  }
): Promise<TripReminderResponse> {
  const updateData: any = {
    ...(data.title && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.remindDate && { remindDate: data.remindDate }),
    ...(data.status && { status: data.status }),
    ...(data.priority && { priority: data.priority }),
    ...(data.checklistItems && { checklistItems: stringifyJsonField(data.checklistItems) }),
    ...(data.notes !== undefined && { notes: data.notes }),
  };

  // If marking as completed, set completedAt
  if (data.status === ReminderStatus.COMPLETED) {
    updateData.completedAt = new Date();
  }

  const reminder = await prisma.tripReminder.update({
    where: { id },
    data: updateData,
  });

  return mapReminderToResponse(reminder);
}

// Get due reminders (upcoming or overdue)
export async function getDueReminders(
  tripId: string,
  daysAhead: number = 7
): Promise<TripReminderResponse[]> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const reminders = await prisma.tripReminder.findMany({
    where: {
      tripId,
      status: ReminderStatus.PENDING,
      remindDate: {
        lte: futureDate,
      },
    },
    orderBy: [{ remindDate: 'asc' }, { priority: 'desc' }],
  });

  return reminders.map(mapReminderToResponse);
}

// Helper to map Prisma model to response type
function mapReminderToResponse(reminder: any): TripReminderResponse {
  return {
    id: reminder.id,
    tripId: reminder.tripId,
    tripItemId: reminder.tripItemId || undefined,
    title: reminder.title,
    description: reminder.description || undefined,
    remindDate: reminder.remindDate,
    status: reminder.status,
    priority: reminder.priority,
    taskType: reminder.taskType || undefined,
    checklistItems: parseJsonField<Array<{ task: string; completed: boolean }>>(
      reminder.checklistItems
    ),
    completedAt: reminder.completedAt || undefined,
    notes: reminder.notes || undefined,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
  };
}
