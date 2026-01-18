import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { TripItemType, TripItemStatus, TripItemPriority } from '@prisma/client';
import type { TripItemResponse, TripItemOptionResponse } from '../types';

// Helper functions
function decimalToNumber(value: Decimal | null): number | undefined {
  return value ? value.toNumber() : undefined;
}

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

// Add trip item
export async function addTripItem(data: {
  tripId: string;
  type: TripItemType;
  name: string;
  description?: string;
  date?: Date;
  timeStart?: string;
  timeEnd?: string;
  durationHours?: number;
  location?: string;
  address?: string;
  status?: TripItemStatus;
  priority?: TripItemPriority;
  costEstimate?: number;
  costIsPerPerson?: boolean;
  currency?: string;
  bookingUrl?: string;
  bookingDeadline?: Date;
  tags?: string[];
  notes?: string;
}): Promise<TripItemResponse> {
  const item = await prisma.tripItem.create({
    data: {
      tripId: data.tripId,
      type: data.type,
      name: data.name,
      description: data.description,
      date: data.date,
      timeStart: data.timeStart,
      timeEnd: data.timeEnd,
      durationHours: data.durationHours ? new Decimal(data.durationHours) : null,
      location: data.location,
      address: data.address,
      status: data.status || TripItemStatus.IDEA,
      priority: data.priority || TripItemPriority.MEDIUM,
      costEstimate: data.costEstimate ? new Decimal(data.costEstimate) : null,
      costIsPerPerson: data.costIsPerPerson || false,
      currency: data.currency || 'AUD',
      bookingUrl: data.bookingUrl,
      bookingDeadline: data.bookingDeadline,
      tags: stringifyJsonField(data.tags),
      notes: data.notes,
    },
  });

  return mapTripItemToResponse(item);
}

// List trip items with filters
export async function listTripItems(
  tripId: string,
  filters?: {
    type?: TripItemType;
    status?: TripItemStatus | TripItemStatus[];
    priority?: TripItemPriority;
    dateFrom?: Date;
    dateTo?: Date;
    unscheduledOnly?: boolean;
  }
): Promise<TripItemResponse[]> {
  const items = await prisma.tripItem.findMany({
    where: {
      tripId,
      ...(filters?.type && { type: filters.type }),
      ...(filters?.status && {
        status: Array.isArray(filters.status) ? { in: filters.status } : filters.status,
      }),
      ...(filters?.priority && { priority: filters.priority }),
      ...(filters?.dateFrom && { date: { gte: filters.dateFrom } }),
      ...(filters?.dateTo && { date: { lte: filters.dateTo } }),
      ...(filters?.unscheduledOnly && { date: null }),
    },
    include: {
      options: true,
    },
    orderBy: [{ date: 'asc' }, { priority: 'desc' }],
  });

  return items.map(mapTripItemToResponse);
}

// Update trip item
export async function updateTripItem(
  id: string,
  data: {
    name?: string;
    description?: string;
    date?: Date;
    timeStart?: string;
    timeEnd?: string;
    status?: TripItemStatus;
    priority?: TripItemPriority;
    costEstimate?: number;
    costActual?: number;
    bookingReference?: string;
    confirmationNumber?: string;
    notes?: string;
  }
): Promise<TripItemResponse> {
  const item = await prisma.tripItem.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.date !== undefined && { date: data.date }),
      ...(data.timeStart !== undefined && { timeStart: data.timeStart }),
      ...(data.timeEnd !== undefined && { timeEnd: data.timeEnd }),
      ...(data.status && { status: data.status }),
      ...(data.priority && { priority: data.priority }),
      ...(data.costEstimate !== undefined && {
        costEstimate: data.costEstimate ? new Decimal(data.costEstimate) : null,
      }),
      ...(data.costActual !== undefined && {
        costActual: data.costActual ? new Decimal(data.costActual) : null,
      }),
      ...(data.bookingReference !== undefined && {
        bookingReference: data.bookingReference,
      }),
      ...(data.confirmationNumber !== undefined && {
        confirmationNumber: data.confirmationNumber,
      }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: { options: true },
  });

  return mapTripItemToResponse(item);
}

// Delete trip item
export async function deleteTripItem(id: string): Promise<{ success: boolean }> {
  await prisma.tripItem.delete({ where: { id } });
  return { success: true };
}

// Add option to item
export async function addTripItemOption(data: {
  tripItemId: string;
  name: string;
  description?: string;
  costEstimate?: number;
  costIsPerPerson?: boolean;
  currency?: string;
  pros?: string[];
  cons?: string[];
  url?: string;
  notes?: string;
}): Promise<TripItemOptionResponse> {
  const option = await prisma.tripItemOption.create({
    data: {
      tripItemId: data.tripItemId,
      name: data.name,
      description: data.description,
      costEstimate: data.costEstimate ? new Decimal(data.costEstimate) : null,
      costIsPerPerson: data.costIsPerPerson || false,
      currency: data.currency || 'AUD',
      pros: stringifyJsonField(data.pros),
      cons: stringifyJsonField(data.cons),
      url: data.url,
      notes: data.notes,
    },
  });

  return mapOptionToResponse(option);
}

// Select option (marks as SELECTED, others as REJECTED)
export async function selectTripItemOption(
  optionId: string,
  rejectionReason?: string
): Promise<{ success: boolean; message: string }> {
  const option = await prisma.tripItemOption.findUnique({
    where: { id: optionId },
  });

  if (!option) {
    throw new Error('Option not found');
  }

  // Update selected option
  await prisma.tripItemOption.update({
    where: { id: optionId },
    data: { status: TripItemStatus.SHORTLISTED },
  });

  // Reject other options
  await prisma.tripItemOption.updateMany({
    where: {
      tripItemId: option.tripItemId,
      id: { not: optionId },
    },
    data: {
      status: TripItemStatus.REJECTED,
      rejectionReason,
    },
  });

  return {
    success: true,
    message: 'Option selected successfully',
  };
}

// Helper to map Prisma model to response type
function mapTripItemToResponse(item: any): TripItemResponse {
  return {
    id: item.id,
    tripId: item.tripId,
    type: item.type,
    name: item.name,
    description: item.description || undefined,
    date: item.date || undefined,
    timeStart: item.timeStart || undefined,
    timeEnd: item.timeEnd || undefined,
    durationHours: decimalToNumber(item.durationHours),
    location: item.location || undefined,
    locationId: item.locationId || undefined,
    address: item.address || undefined,
    latitude: decimalToNumber(item.latitude),
    longitude: decimalToNumber(item.longitude),
    status: item.status,
    priority: item.priority,
    costEstimate: decimalToNumber(item.costEstimate),
    costActual: decimalToNumber(item.costActual),
    costIsPerPerson: item.costIsPerPerson,
    currency: item.currency,
    bookingUrl: item.bookingUrl || undefined,
    bookingReference: item.bookingReference || undefined,
    confirmationNumber: item.confirmationNumber || undefined,
    bookingDeadline: item.bookingDeadline || undefined,
    cancellationPolicy: item.cancellationPolicy || undefined,
    isCancellable: item.isCancellable,
    cancellationDeadline: item.cancellationDeadline || undefined,
    requiresId: item.requiresId,
    ageRestrictions: item.ageRestrictions || undefined,
    departureLocationId: item.departureLocationId || undefined,
    arrivalLocationId: item.arrivalLocationId || undefined,
    departureTime: item.departureTime || undefined,
    arrivalTime: item.arrivalTime || undefined,
    connectionToItemId: item.connectionToItemId || undefined,
    seatNumbers: item.seatNumbers || undefined,
    terminal: item.terminal || undefined,
    gate: item.gate || undefined,
    partySize: item.partySize || undefined,
    dietaryRequirements: parseJsonField<string[]>(item.dietaryRequirements),
    specialRequests: item.specialRequests || undefined,
    budgetCategoryId: item.budgetCategoryId || undefined,
    expenseId: item.expenseId || undefined,
    tags: parseJsonField<string[]>(item.tags),
    notes: item.notes || undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    options: item.options?.map(mapOptionToResponse),
  };
}

function mapOptionToResponse(option: any): TripItemOptionResponse {
  return {
    id: option.id,
    tripItemId: option.tripItemId,
    name: option.name,
    description: option.description || undefined,
    costEstimate: decimalToNumber(option.costEstimate),
    costIsPerPerson: option.costIsPerPerson,
    currency: option.currency,
    pros: parseJsonField<string[]>(option.pros),
    cons: parseJsonField<string[]>(option.cons),
    url: option.url || undefined,
    status: option.status,
    rejectionReason: option.rejectionReason || undefined,
    notes: option.notes || undefined,
    createdAt: option.createdAt,
    updatedAt: option.updatedAt,
  };
}
