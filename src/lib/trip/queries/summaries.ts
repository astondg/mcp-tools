import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { TripItemStatus, TripItemType, PackingStatus } from '@prisma/client';
import type { TripStatusSummary, TripBudgetSummary } from '../types';

function decimalToNumber(value: Decimal | null): number {
  return value ? value.toNumber() : 0;
}

// Get trip status summary
export async function getTripStatus(tripId: string): Promise<TripStatusSummary> {
  const [items, packingItems, reminders] = await Promise.all([
    prisma.tripItem.findMany({ where: { tripId } }),
    prisma.tripPackingItem.findMany({ where: { tripId } }),
    prisma.tripReminder.findMany({
      where: { tripId, status: 'PENDING' },
      orderBy: { remindDate: 'asc' },
      take: 5,
    }),
  ]);

  // Count by status
  const byStatus: Record<TripItemStatus, number> = {
    IDEA: 0,
    RESEARCHED: 0,
    SHORTLISTED: 0,
    BOOKED: 0,
    CONFIRMED: 0,
    WAITLISTED: 0,
    CANCELLED: 0,
    REJECTED: 0,
  };
  items.forEach((item) => {
    byStatus[item.status]++;
  });

  // Count by type
  const byType: Record<TripItemType, number> = {
    FLIGHT: 0,
    ACCOMMODATION: 0,
    ACTIVITY: 0,
    MEAL: 0,
    TRANSPORT: 0,
    EVENT: 0,
    MEETING: 0,
    OTHER: 0,
  };
  items.forEach((item) => {
    byType[item.type]++;
  });

  // Calculate budgets
  const budgetEstimated = items.reduce((sum, item) => {
    return sum + decimalToNumber(item.costEstimate);
  }, 0);

  const budgetBooked = items
    .filter((item) => item.status === 'BOOKED' || item.status === 'CONFIRMED')
    .reduce((sum, item) => {
      return sum + decimalToNumber(item.costEstimate);
    }, 0);

  const budgetActual = items.reduce((sum, item) => {
    return sum + decimalToNumber(item.costActual);
  }, 0);

  // Upcoming deadlines
  const now = new Date();
  const upcomingDeadlines = items
    .filter((item) => item.bookingDeadline && item.bookingDeadline > now)
    .sort((a, b) => a.bookingDeadline!.getTime() - b.bookingDeadline!.getTime())
    .slice(0, 5)
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      deadline: item.bookingDeadline!,
      type: 'booking' as const,
    }));

  // Packing status
  const packingStatus: Record<PackingStatus, number> = {
    OWNED: 0,
    TO_BUY: 0,
    ORDERED: 0,
    PACKED: 0,
  };
  packingItems.forEach((item) => {
    packingStatus[item.status]++;
  });

  return {
    totalItems: items.length,
    byStatus,
    byType,
    budgetEstimated,
    budgetBooked,
    budgetActual,
    upcomingDeadlines,
    pendingReminders: reminders.map((r) => ({
      id: r.id,
      tripId: r.tripId,
      tripItemId: r.tripItemId || undefined,
      title: r.title,
      description: r.description || undefined,
      remindDate: r.remindDate,
      status: r.status,
      priority: r.priority,
      taskType: r.taskType || undefined,
      checklistItems: r.checklistItems ? JSON.parse(r.checklistItems) : undefined,
      completedAt: r.completedAt || undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    packingStatus,
  };
}

// Get budget summary
export async function getTripBudgetSummary(tripId: string): Promise<TripBudgetSummary> {
  const [trip, items, packingItems] = await Promise.all([
    prisma.trip.findUnique({ where: { id: tripId } }),
    prisma.tripItem.findMany({ where: { tripId } }),
    prisma.tripPackingItem.findMany({
      where: { tripId, status: 'TO_BUY' },
    }),
  ]);

  if (!trip) {
    throw new Error('Trip not found');
  }

  // Estimated totals by type
  const estimatedByType: Record<TripItemType, number> = {
    FLIGHT: 0,
    ACCOMMODATION: 0,
    ACTIVITY: 0,
    MEAL: 0,
    TRANSPORT: 0,
    EVENT: 0,
    MEETING: 0,
    OTHER: 0,
  };

  // Estimated totals by status
  const estimatedByStatus: Record<TripItemStatus, number> = {
    IDEA: 0,
    RESEARCHED: 0,
    SHORTLISTED: 0,
    BOOKED: 0,
    CONFIRMED: 0,
    WAITLISTED: 0,
    CANCELLED: 0,
    REJECTED: 0,
  };

  // Estimated totals by currency
  const estimatedByCurrency: Record<string, number> = {};

  // Actual totals by type
  const actualByType: Record<TripItemType, number> = {
    FLIGHT: 0,
    ACCOMMODATION: 0,
    ACTIVITY: 0,
    MEAL: 0,
    TRANSPORT: 0,
    EVENT: 0,
    MEETING: 0,
    OTHER: 0,
  };

  let estimatedTotal = 0;
  let actualTotal = 0;

  items.forEach((item) => {
    const estimate = decimalToNumber(item.costEstimate);
    const actual = decimalToNumber(item.costActual);

    estimatedTotal += estimate;
    estimatedByType[item.type] += estimate;
    estimatedByStatus[item.status] += estimate;

    if (!estimatedByCurrency[item.currency]) {
      estimatedByCurrency[item.currency] = 0;
    }
    estimatedByCurrency[item.currency] += estimate;

    if (actual > 0) {
      actualTotal += actual;
      actualByType[item.type] += actual;
    }
  });

  // Packing to buy
  const packingToBuy = packingItems.reduce((sum, item) => {
    return sum + decimalToNumber(item.purchasePrice);
  }, 0);

  const budgetTotal = decimalToNumber(trip.budgetTotal);
  const remaining = budgetTotal - actualTotal - packingToBuy;

  return {
    budgetTotal: budgetTotal || undefined,
    currency: trip.currency,
    estimated: {
      total: estimatedTotal,
      byType: estimatedByType,
      byStatus: estimatedByStatus,
      byCurrency: estimatedByCurrency,
    },
    actual: {
      total: actualTotal,
      byType: actualByType,
    },
    remaining,
    packingToBuy,
  };
}
