import { prisma } from '@/lib/db';
import {
  ItineraryStatus,
  TimeSlot,
  DayPace,
  TripItinerary,
  TripItineraryDay,
  TripItinerarySlot,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { notFoundError, handleQueryError } from '@/lib/shared/errors';
import type {
  TripItineraryResponse,
  TripItineraryDayResponse,
  TripItinerarySlotResponse,
} from '../types';

/**
 * Convert Prisma Decimal to number
 */
function decimalToNumber(value: Decimal | null): number | undefined {
  return value ? value.toNumber() : undefined;
}

/**
 * Create a new itinerary for a trip
 *
 * @param data - Itinerary data
 * @param data.tripId - The trip ID
 * @param data.name - Itinerary name
 * @param data.notes - Optional notes (stored in 'notes' field in schema)
 * @param data.status - Optional status (defaults to DRAFT)
 * @returns The created itinerary
 */
export async function createItinerary(data: {
  tripId: string;
  name: string;
  notes?: string;
  status?: ItineraryStatus;
}): Promise<TripItineraryResponse> {
  try {
    const itinerary = await prisma.tripItinerary.create({
      data: {
        tripId: data.tripId,
        name: data.name,
        notes: data.notes,
        status: data.status ?? ItineraryStatus.DRAFT,
      },
    });

    return mapItineraryToResponse(itinerary);
  } catch (error) {
    throw handleQueryError(error, 'createItinerary');
  }
}

/**
 * List all itineraries for a trip
 *
 * @param tripId - The trip ID
 * @returns List of itineraries
 */
export async function listItineraries(tripId: string): Promise<TripItineraryResponse[]> {
  try {
    const itineraries = await prisma.tripItinerary.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    });

    return itineraries.map(mapItineraryToResponse);
  } catch (error) {
    throw handleQueryError(error, 'listItineraries');
  }
}

/**
 * Get a single itinerary with days and slots
 *
 * @param id - Itinerary ID
 * @returns The itinerary with nested days and slots
 * @throws {McpToolError} if itinerary not found
 */
export async function getItinerary(id: string): Promise<TripItineraryResponse> {
  try {
    const itinerary = await prisma.tripItinerary.findUnique({
      where: { id },
      include: {
        days: {
          include: {
            slots: {
              include: {
                tripItem: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });

    if (!itinerary) {
      throw notFoundError('Itinerary', id);
    }

    return {
      ...mapItineraryToResponse(itinerary),
      days: itinerary.days.map(mapDayToResponse),
    };
  } catch (error) {
    throw handleQueryError(error, 'getItinerary');
  }
}

/**
 * Update an existing itinerary
 *
 * @param id - Itinerary ID
 * @param data - Fields to update
 * @returns The updated itinerary
 */
export async function updateItinerary(
  id: string,
  data: {
    name?: string;
    notes?: string;
    status?: ItineraryStatus;
  }
): Promise<TripItineraryResponse> {
  try {
    const itinerary = await prisma.tripItinerary.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status && { status: data.status }),
      },
    });

    return mapItineraryToResponse(itinerary);
  } catch (error) {
    throw handleQueryError(error, 'updateItinerary');
  }
}

/**
 * Generate days for an itinerary based on trip dates
 *
 * @param itineraryId - The itinerary ID
 * @returns Success status and count of days created
 * @throws {McpToolError} if itinerary not found
 */
export async function generateItineraryDays(
  itineraryId: string
): Promise<{ success: boolean; daysCreated: number }> {
  try {
    const itinerary = await prisma.tripItinerary.findUnique({
      where: { id: itineraryId },
      include: { trip: true },
    });

    if (!itinerary) {
      throw notFoundError('Itinerary', itineraryId);
    }

    const { startDate, endDate } = itinerary.trip;
    const days: Array<{
      itineraryId: string;
      dayNumber: number;
      date: Date;
      theme: string;
      pace: DayPace;
    }> = [];
    let dayNumber = 1;

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1), dayNumber++
    ) {
      days.push({
        itineraryId: itineraryId,
        dayNumber,
        date: new Date(date),
        theme: `Day ${dayNumber}`,
        pace: DayPace.MEDIUM,
      });
    }

    await prisma.tripItineraryDay.createMany({
      data: days,
      skipDuplicates: true,
    });

    return {
      success: true,
      daysCreated: days.length,
    };
  } catch (error) {
    throw handleQueryError(error, 'generateItineraryDays');
  }
}

/**
 * Update an itinerary day
 *
 * @param id - Day ID
 * @param data - Fields to update
 * @param data.theme - Day theme (stored in 'theme' field in schema)
 * @param data.pace - Day pace
 * @param data.notes - Optional notes
 * @returns The updated day
 */
export async function updateItineraryDay(
  id: string,
  data: {
    theme?: string;
    pace?: DayPace;
    notes?: string;
  }
): Promise<TripItineraryDayResponse> {
  try {
    const day = await prisma.tripItineraryDay.update({
      where: { id },
      data: {
        ...(data.theme && { theme: data.theme }),
        ...(data.pace && { pace: data.pace }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    return mapDayToResponse(day);
  } catch (error) {
    throw handleQueryError(error, 'updateItineraryDay');
  }
}

/**
 * Add a slot to an itinerary day
 *
 * @param data - Slot data
 * @param data.itineraryDayId - The day ID
 * @param data.timeSlot - Time slot (MORNING, AFTERNOON, EVENING, etc.)
 * @param data.timeStart - Optional specific start time (stored in 'timeStart' field)
 * @param data.timeEnd - Optional specific end time (stored in 'timeEnd' field)
 * @param data.description - Optional description
 * @returns The created slot
 */
export async function addItinerarySlot(data: {
  itineraryDayId: string;
  tripItemId?: string;
  timeSlot?: TimeSlot;
  timeStart?: string;
  timeEnd?: string;
  description?: string;
  backupTripItemId?: string;
  travelTimeMinutes?: number;
  estimatedCost?: number;
  weatherDependent?: boolean;
  requiresBooking?: boolean;
  notes?: string;
  sortOrder?: number;
}): Promise<TripItinerarySlotResponse> {
  try {
    const slot = await prisma.tripItinerarySlot.create({
      data: {
        itineraryDayId: data.itineraryDayId,
        tripItemId: data.tripItemId,
        timeSlot: data.timeSlot ?? TimeSlot.MORNING,
        timeStart: data.timeStart,
        timeEnd: data.timeEnd,
        description: data.description,
        backupTripItemId: data.backupTripItemId,
        travelTimeMinutes: data.travelTimeMinutes,
        estimatedCost: data.estimatedCost ? new Decimal(data.estimatedCost) : null,
        weatherDependent: data.weatherDependent ?? false,
        requiresBooking: data.requiresBooking ?? false,
        notes: data.notes,
        sortOrder: data.sortOrder ?? 0,
      },
      include: {
        tripItem: true,
      },
    });

    return mapSlotToResponse(slot);
  } catch (error) {
    throw handleQueryError(error, 'addItinerarySlot');
  }
}

/**
 * Update an itinerary slot
 *
 * @param id - Slot ID
 * @param data - Fields to update
 * @returns The updated slot
 */
export async function updateItinerarySlot(
  id: string,
  data: {
    tripItemId?: string;
    timeSlot?: TimeSlot;
    timeStart?: string;
    timeEnd?: string;
    description?: string;
    backupTripItemId?: string;
    travelTimeMinutes?: number;
    estimatedCost?: number;
    weatherDependent?: boolean;
    requiresBooking?: boolean;
    notes?: string;
    sortOrder?: number;
  }
): Promise<TripItinerarySlotResponse> {
  try {
    const slot = await prisma.tripItinerarySlot.update({
      where: { id },
      data: {
        ...(data.tripItemId !== undefined && { tripItemId: data.tripItemId }),
        ...(data.timeSlot && { timeSlot: data.timeSlot }),
        ...(data.timeStart !== undefined && { timeStart: data.timeStart }),
        ...(data.timeEnd !== undefined && { timeEnd: data.timeEnd }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.backupTripItemId !== undefined && { backupTripItemId: data.backupTripItemId }),
        ...(data.travelTimeMinutes !== undefined && { travelTimeMinutes: data.travelTimeMinutes }),
        ...(data.estimatedCost !== undefined && {
          estimatedCost: data.estimatedCost ? new Decimal(data.estimatedCost) : null,
        }),
        ...(data.weatherDependent !== undefined && { weatherDependent: data.weatherDependent }),
        ...(data.requiresBooking !== undefined && { requiresBooking: data.requiresBooking }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
      include: {
        tripItem: true,
      },
    });

    return mapSlotToResponse(slot);
  } catch (error) {
    throw handleQueryError(error, 'updateItinerarySlot');
  }
}

/**
 * Delete an itinerary slot
 *
 * @param id - Slot ID
 * @returns Success status
 */
export async function deleteItinerarySlot(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.tripItinerarySlot.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    throw handleQueryError(error, 'deleteItinerarySlot');
  }
}

/**
 * Auto-populate an itinerary with booked trip items
 *
 * @param itineraryId - The itinerary ID
 * @returns Success status and count of slots created
 * @throws {McpToolError} if itinerary not found
 */
export async function autoPopulateItinerary(
  itineraryId: string
): Promise<{ success: boolean; slotsCreated: number }> {
  try {
    const itinerary = await prisma.tripItinerary.findUnique({
      where: { id: itineraryId },
      include: {
        trip: {
          include: {
            items: {
              where: {
                status: { in: ['BOOKED', 'CONFIRMED'] },
                date: { not: null },
              },
              orderBy: [{ date: 'asc' }, { timeStart: 'asc' }],
            },
          },
        },
        days: true,
      },
    });

    if (!itinerary) {
      throw notFoundError('Itinerary', itineraryId);
    }

    let slotsCreated = 0;

    for (const item of itinerary.trip.items) {
      if (!item.date) continue;

      // Find matching day by date
      const day = itinerary.days.find(
        (d) => d.date.toISOString().split('T')[0] === item.date!.toISOString().split('T')[0]
      );

      if (day) {
        await prisma.tripItinerarySlot.create({
          data: {
            itineraryDayId: day.id,
            tripItemId: item.id,
            timeSlot: TimeSlot.MORNING,
            timeStart: item.timeStart ?? undefined,
            timeEnd: item.timeEnd ?? undefined,
            description: item.description ?? item.name,
          },
        });
        slotsCreated++;
      }
    }

    return {
      success: true,
      slotsCreated,
    };
  } catch (error) {
    throw handleQueryError(error, 'autoPopulateItinerary');
  }
}

/**
 * Map Prisma TripItinerary model to response type
 */
function mapItineraryToResponse(itinerary: TripItinerary): TripItineraryResponse {
  return {
    id: itinerary.id,
    tripId: itinerary.tripId,
    version: itinerary.version,
    name: itinerary.name,
    status: itinerary.status,
    notes: itinerary.notes ?? undefined,
    createdAt: itinerary.createdAt,
    updatedAt: itinerary.updatedAt,
  };
}

/**
 * Map Prisma TripItineraryDay model to response type
 */
function mapDayToResponse(
  day: TripItineraryDay & { slots?: Array<TripItinerarySlot & { tripItem?: unknown }> }
): TripItineraryDayResponse {
  return {
    id: day.id,
    itineraryId: day.itineraryId,
    dayNumber: day.dayNumber,
    date: day.date,
    theme: day.theme ?? undefined,
    pace: day.pace,
    notes: day.notes ?? undefined,
    createdAt: day.createdAt,
    updatedAt: day.updatedAt,
    slots: day.slots?.map(mapSlotToResponse),
  };
}

/**
 * Map Prisma TripItinerarySlot model to response type
 */
function mapSlotToResponse(
  slot: TripItinerarySlot & { tripItem?: unknown }
): TripItinerarySlotResponse {
  return {
    id: slot.id,
    itineraryDayId: slot.itineraryDayId,
    tripItemId: slot.tripItemId ?? undefined,
    timeSlot: slot.timeSlot,
    timeStart: slot.timeStart ?? undefined,
    timeEnd: slot.timeEnd ?? undefined,
    description: slot.description ?? undefined,
    travelTimeMinutes: slot.travelTimeMinutes ?? undefined,
    backupTripItemId: slot.backupTripItemId ?? undefined,
    estimatedCost: decimalToNumber(slot.estimatedCost),
    weatherDependent: slot.weatherDependent,
    requiresBooking: slot.requiresBooking,
    notes: slot.notes ?? undefined,
    sortOrder: slot.sortOrder,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  };
}
