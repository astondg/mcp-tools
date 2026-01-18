import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  TripItineraryResponse,
  TripItineraryDayResponse,
  TripItinerarySlotResponse,
} from '../types';

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

// Create itinerary
export async function createItinerary(data: {
  tripId: string;
  name: string;
  description?: string;
  isActive?: boolean;
}): Promise<TripItineraryResponse> {
  const itinerary = await prisma.tripItinerary.create({
    data: {
      tripId: data.tripId,
      name: data.name,
      description: data.description,
      isActive: data.isActive || false,
    },
  });

  return {
    id: itinerary.id,
    tripId: itinerary.tripId,
    name: itinerary.name,
    description: itinerary.description || undefined,
    isActive: itinerary.isActive,
    createdAt: itinerary.createdAt,
    updatedAt: itinerary.updatedAt,
  };
}

// List itineraries
export async function listItineraries(tripId: string): Promise<TripItineraryResponse[]> {
  const itineraries = await prisma.tripItinerary.findMany({
    where: { tripId },
    orderBy: { createdAt: 'desc' },
  });

  return itineraries.map((i) => ({
    id: i.id,
    tripId: i.tripId,
    name: i.name,
    description: i.description || undefined,
    isActive: i.isActive,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));
}

// Get itinerary with days and slots
export async function getItinerary(id: string): Promise<TripItineraryResponse> {
  const itinerary = await prisma.tripItinerary.findUnique({
    where: { id },
    include: {
      days: {
        include: {
          slots: {
            include: {
              tripItem: true,
              backupTripItem: true,
            },
            orderBy: { startTime: 'asc' },
          },
        },
        orderBy: { dayNumber: 'asc' },
      },
    },
  });

  if (!itinerary) {
    throw new Error('Itinerary not found');
  }

  return {
    id: itinerary.id,
    tripId: itinerary.tripId,
    name: itinerary.name,
    description: itinerary.description || undefined,
    isActive: itinerary.isActive,
    createdAt: itinerary.createdAt,
    updatedAt: itinerary.updatedAt,
    days: itinerary.days.map(mapDayToResponse),
  };
}

// Update itinerary
export async function updateItinerary(
  id: string,
  data: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<TripItineraryResponse> {
  const itinerary = await prisma.tripItinerary.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  return {
    id: itinerary.id,
    tripId: itinerary.tripId,
    name: itinerary.name,
    description: itinerary.description || undefined,
    isActive: itinerary.isActive,
    createdAt: itinerary.createdAt,
    updatedAt: itinerary.updatedAt,
  };
}

// Generate days for itinerary (based on trip dates)
export async function generateItineraryDays(
  itineraryId: string
): Promise<{ success: boolean; daysCreated: number }> {
  const itinerary = await prisma.tripItinerary.findUnique({
    where: { id: itineraryId },
    include: { trip: true },
  });

  if (!itinerary) {
    throw new Error('Itinerary not found');
  }

  const { startDate, endDate } = itinerary.trip;
  const days: any[] = [];
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
      title: `Day ${dayNumber}`,
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
}

// Update day
export async function updateItineraryDay(
  id: string,
  data: {
    title?: string;
    notes?: string;
  }
): Promise<TripItineraryDayResponse> {
  const day = await prisma.tripItineraryDay.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return {
    id: day.id,
    itineraryId: day.itineraryId,
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    notes: day.notes || undefined,
    createdAt: day.createdAt,
    updatedAt: day.updatedAt,
  };
}

// Add slot to day
export async function addItinerarySlot(data: {
  dayId: string;
  tripItemId?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  description?: string;
  location?: string;
  isTentative?: boolean;
  backupTripItemId?: string;
  transportNotes?: string;
  notes?: string;
}): Promise<TripItinerarySlotResponse> {
  const slot = await prisma.tripItinerarySlot.create({
    data: {
      dayId: data.dayId,
      tripItemId: data.tripItemId,
      startTime: data.startTime,
      endTime: data.endTime,
      title: data.title,
      description: data.description,
      location: data.location,
      isTentative: data.isTentative || false,
      backupTripItemId: data.backupTripItemId,
      transportNotes: data.transportNotes,
      notes: data.notes,
    },
    include: {
      tripItem: true,
      backupTripItem: true,
    },
  });

  return mapSlotToResponse(slot);
}

// Update slot
export async function updateItinerarySlot(
  id: string,
  data: {
    tripItemId?: string;
    startTime?: string;
    endTime?: string;
    title?: string;
    description?: string;
    location?: string;
    isTentative?: boolean;
    transportNotes?: string;
    notes?: string;
  }
): Promise<TripItinerarySlotResponse> {
  const slot = await prisma.tripItinerarySlot.update({
    where: { id },
    data: {
      ...(data.tripItemId !== undefined && { tripItemId: data.tripItemId }),
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.isTentative !== undefined && { isTentative: data.isTentative }),
      ...(data.transportNotes !== undefined && { transportNotes: data.transportNotes }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: {
      tripItem: true,
      backupTripItem: true,
    },
  });

  return mapSlotToResponse(slot);
}

// Delete slot
export async function deleteItinerarySlot(id: string): Promise<{ success: boolean }> {
  await prisma.tripItinerarySlot.delete({ where: { id } });
  return { success: true };
}

// Auto-populate itinerary from booked items
export async function autoPopulateItinerary(
  itineraryId: string
): Promise<{ success: boolean; slotsCreated: number }> {
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
    throw new Error('Itinerary not found');
  }

  let slotsCreated = 0;

  for (const item of itinerary.trip.items) {
    if (!item.date) continue;

    // Find matching day
    const day = itinerary.days.find(
      (d) => d.date.toISOString().split('T')[0] === item.date!.toISOString().split('T')[0]
    );

    if (day) {
      await prisma.tripItinerarySlot.create({
        data: {
          dayId: day.id,
          tripItemId: item.id,
          startTime: item.timeStart || undefined,
          endTime: item.timeEnd || undefined,
          title: item.name,
          description: item.description || undefined,
          location: item.location || undefined,
        },
      });
      slotsCreated++;
    }
  }

  return {
    success: true,
    slotsCreated,
  };
}

// Helper to map day to response
function mapDayToResponse(day: any): TripItineraryDayResponse {
  return {
    id: day.id,
    itineraryId: day.itineraryId,
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    notes: day.notes || undefined,
    createdAt: day.createdAt,
    updatedAt: day.updatedAt,
    slots: day.slots?.map(mapSlotToResponse),
  };
}

// Helper to map slot to response
function mapSlotToResponse(slot: any): TripItinerarySlotResponse {
  return {
    id: slot.id,
    dayId: slot.dayId,
    tripItemId: slot.tripItemId || undefined,
    startTime: slot.startTime || undefined,
    endTime: slot.endTime || undefined,
    title: slot.title || undefined,
    description: slot.description || undefined,
    location: slot.location || undefined,
    isTentative: slot.isTentative,
    backupTripItemId: slot.backupTripItemId || undefined,
    transportNotes: slot.transportNotes || undefined,
    notes: slot.notes || undefined,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  };
}
