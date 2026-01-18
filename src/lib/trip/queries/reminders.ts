import { prisma } from '@/lib/db';
import { ReminderStatus, TripItemPriority, TripReminder } from '@prisma/client';
import { handleQueryError } from '@/lib/shared/errors';
import type { TripReminderResponse, ChecklistItem } from '../types';

/**
 * Parse JSON string field to typed value
 */
function parseJsonField<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Add a new reminder to a trip
 *
 * @param data - Reminder data
 * @returns The created reminder
 */
export async function addReminder(data: {
  tripId: string;
  tripItemId?: string;
  title: string;
  description?: string;
  remindDate: Date;
  priority?: TripItemPriority;
  taskType?: string;
  checklistItems?: ChecklistItem[];
}): Promise<TripReminderResponse> {
  try {
    const reminder = await prisma.tripReminder.create({
      data: {
        tripId: data.tripId,
        tripItemId: data.tripItemId,
        title: data.title,
        description: data.description,
        remindDate: data.remindDate,
        status: ReminderStatus.PENDING,
        priority: data.priority ?? TripItemPriority.MEDIUM,
        taskType: data.taskType,
        checklistItems: data.checklistItems ? JSON.stringify(data.checklistItems) : null,
      },
    });

    return mapReminderToResponse(reminder);
  } catch (error) {
    throw handleQueryError(error, 'addReminder');
  }
}

/**
 * List reminders for a trip with optional filters
 *
 * @param tripId - The trip ID
 * @param filters - Optional filters
 * @returns List of reminders
 */
export async function listReminders(
  tripId: string,
  filters?: {
    status?: ReminderStatus | ReminderStatus[];
    priority?: TripItemPriority;
    taskType?: string;
    tripItemId?: string;
    overdueOnly?: boolean;
  }
): Promise<TripReminderResponse[]> {
  try {
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
  } catch (error) {
    throw handleQueryError(error, 'listReminders');
  }
}

/**
 * Update an existing reminder
 *
 * @param id - Reminder ID
 * @param data - Fields to update
 * @returns The updated reminder
 */
export async function updateReminder(
  id: string,
  data: {
    title?: string;
    description?: string;
    remindDate?: Date;
    status?: ReminderStatus;
    priority?: TripItemPriority;
    checklistItems?: ChecklistItem[];
  }
): Promise<TripReminderResponse> {
  try {
    const updateData: Record<string, unknown> = {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.remindDate && { remindDate: data.remindDate }),
      ...(data.status && { status: data.status }),
      ...(data.priority && { priority: data.priority }),
      ...(data.checklistItems !== undefined && {
        checklistItems: data.checklistItems ? JSON.stringify(data.checklistItems) : null,
      }),
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
  } catch (error) {
    throw handleQueryError(error, 'updateReminder');
  }
}

/**
 * Delete a reminder
 *
 * @param id - Reminder ID
 * @returns Success status
 */
export async function deleteReminder(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.tripReminder.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    throw handleQueryError(error, 'deleteReminder');
  }
}

/**
 * Get reminders that are due within a specified number of days
 *
 * @param tripId - The trip ID
 * @param daysAhead - Number of days to look ahead (default: 7)
 * @returns List of due reminders
 */
export async function getDueReminders(
  tripId: string,
  daysAhead: number = 7
): Promise<TripReminderResponse[]> {
  try {
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
  } catch (error) {
    throw handleQueryError(error, 'getDueReminders');
  }
}

/**
 * Map Prisma TripReminder model to response type
 */
function mapReminderToResponse(reminder: TripReminder): TripReminderResponse {
  return {
    id: reminder.id,
    tripId: reminder.tripId,
    tripItemId: reminder.tripItemId ?? undefined,
    title: reminder.title,
    description: reminder.description ?? undefined,
    remindDate: reminder.remindDate,
    status: reminder.status,
    priority: reminder.priority,
    taskType: reminder.taskType ?? undefined,
    checklistItems: parseJsonField<ChecklistItem[]>(reminder.checklistItems),
    completedAt: reminder.completedAt ?? undefined,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
  };
}
