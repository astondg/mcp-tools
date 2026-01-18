import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { TripStatus } from '@prisma/client';
import type { TripResponse, Traveller, ExpectedWeather, ExchangeRates } from '../types';

// Helper to convert Decimal to number
function decimalToNumber(value: Decimal | null): number | undefined {
  return value ? value.toNumber() : undefined;
}

// Helper to parse JSON fields safely
function parseJsonField<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

// Helper to stringify JSON fields
function stringifyJsonField<T>(value: T | undefined): string | undefined {
  if (!value) return undefined;
  return JSON.stringify(value);
}

// Create a new trip
export async function createTrip(data: {
  name: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  budgetTotal?: number;
  currency?: string;
  travellers?: Traveller[];
  expectedWeather?: ExpectedWeather;
  seasonalNotes?: string;
  timeZone?: string;
  notes?: string;
}): Promise<TripResponse> {
  const trip = await prisma.trip.create({
    data: {
      name: data.name,
      destination: data.destination,
      startDate: data.startDate,
      endDate: data.endDate,
      budgetTotal: data.budgetTotal ? new Decimal(data.budgetTotal) : null,
      currency: data.currency || 'AUD',
      travellers: stringifyJsonField(data.travellers),
      expectedWeather: stringifyJsonField(data.expectedWeather),
      seasonalNotes: data.seasonalNotes,
      timeZone: data.timeZone,
      notes: data.notes,
    },
  });

  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    travellers: parseJsonField<Traveller[]>(trip.travellers),
    budgetTotal: decimalToNumber(trip.budgetTotal),
    currency: trip.currency,
    exchangeRates: parseJsonField<ExchangeRates>(trip.exchangeRates),
    expectedWeather: parseJsonField<ExpectedWeather>(trip.expectedWeather),
    seasonalNotes: trip.seasonalNotes || undefined,
    timeZone: trip.timeZone || undefined,
    notes: trip.notes || undefined,
    sharingEnabled: trip.sharingEnabled,
    sharingLink: trip.sharingLink || undefined,
    isTemplate: trip.isTemplate,
    clonedFromTripId: trip.clonedFromTripId || undefined,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

// Get a single trip with optional includes
export async function getTrip(
  id: string,
  options?: {
    includeItems?: boolean;
    includePackingItems?: boolean;
    includeItineraries?: boolean;
    includeReminders?: boolean;
    includeDocuments?: boolean;
    includeContacts?: boolean;
    includeLocations?: boolean;
  }
): Promise<TripResponse> {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      items: options?.includeItems
        ? {
            include: {
              options: true,
              structuredLocation: true,
            },
            orderBy: { date: 'asc' },
          }
        : false,
      packingItems: options?.includePackingItems
        ? { orderBy: [{ category: 'asc' }, { priority: 'asc' }] }
        : false,
      itineraries: options?.includeItineraries
        ? {
            include: {
              days: {
                include: { slots: { orderBy: { sortOrder: 'asc' } } },
                orderBy: { date: 'asc' },
              },
            },
            orderBy: { version: 'desc' },
          }
        : false,
      reminders: options?.includeReminders
        ? { orderBy: { remindDate: 'asc' } }
        : false,
      documents: options?.includeDocuments
        ? { orderBy: { createdAt: 'desc' } }
        : false,
      contacts: options?.includeContacts ? true : false,
      locations: options?.includeLocations ? true : false,
    },
  });

  if (!trip) {
    throw new Error('Trip not found');
  }

  const response: TripResponse = {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    travellers: parseJsonField<Traveller[]>(trip.travellers),
    budgetTotal: decimalToNumber(trip.budgetTotal),
    currency: trip.currency,
    exchangeRates: parseJsonField<ExchangeRates>(trip.exchangeRates),
    expectedWeather: parseJsonField<ExpectedWeather>(trip.expectedWeather),
    seasonalNotes: trip.seasonalNotes || undefined,
    timeZone: trip.timeZone || undefined,
    notes: trip.notes || undefined,
    sharingEnabled: trip.sharingEnabled,
    sharingLink: trip.sharingLink || undefined,
    isTemplate: trip.isTemplate,
    clonedFromTripId: trip.clonedFromTripId || undefined,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };

  // Add included relations if requested
  if (options?.includeItems && trip.items) {
    response.items = trip.items.map((item) => ({
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
      options: item.options?.map((opt) => ({
        id: opt.id,
        tripItemId: opt.tripItemId,
        name: opt.name,
        description: opt.description || undefined,
        costEstimate: decimalToNumber(opt.costEstimate),
        costIsPerPerson: opt.costIsPerPerson,
        currency: opt.currency,
        pros: parseJsonField<string[]>(opt.pros),
        cons: parseJsonField<string[]>(opt.cons),
        url: opt.url || undefined,
        status: opt.status,
        rejectionReason: opt.rejectionReason || undefined,
        notes: opt.notes || undefined,
        createdAt: opt.createdAt,
        updatedAt: opt.updatedAt,
      })),
      structuredLocation: item.structuredLocation
        ? {
            id: item.structuredLocation.id,
            tripId: item.structuredLocation.tripId,
            name: item.structuredLocation.name,
            address: item.structuredLocation.address || undefined,
            city: item.structuredLocation.city || undefined,
            country: item.structuredLocation.country || undefined,
            latitude: decimalToNumber(item.structuredLocation.latitude),
            longitude: decimalToNumber(item.structuredLocation.longitude),
            placeId: item.structuredLocation.placeId || undefined,
            type: item.structuredLocation.type,
            notes: item.structuredLocation.notes || undefined,
            createdAt: item.structuredLocation.createdAt,
            updatedAt: item.structuredLocation.updatedAt,
          }
        : undefined,
    }));
  }

  // Add other included relations similarly
  if (options?.includePackingItems && trip.packingItems) {
    response.packingItems = trip.packingItems.map((item) => ({
      id: item.id,
      tripId: item.tripId,
      category: item.category,
      item: item.item,
      quantity: item.quantity,
      status: item.status,
      priority: item.priority,
      purchaseUrl: item.purchaseUrl || undefined,
      purchasePrice: decimalToNumber(item.purchasePrice),
      currency: item.currency,
      purchaseDeadline: item.purchaseDeadline || undefined,
      wishlistItemId: item.wishlistItemId || undefined,
      notes: item.notes || undefined,
      tags: parseJsonField<string[]>(item.tags),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  return response;
}

// List all trips with filters
export async function listTrips(options?: {
  status?: TripStatus;
  includeCompleted?: boolean;
  limit?: number;
}): Promise<TripResponse[]> {
  const trips = await prisma.trip.findMany({
    where: {
      ...(options?.status && { status: options.status }),
      ...(options?.includeCompleted === false && {
        status: { not: TripStatus.COMPLETED },
      }),
    },
    orderBy: { startDate: 'desc' },
    take: options?.limit,
  });

  return trips.map((trip) => ({
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    travellers: parseJsonField<Traveller[]>(trip.travellers),
    budgetTotal: decimalToNumber(trip.budgetTotal),
    currency: trip.currency,
    exchangeRates: parseJsonField<ExchangeRates>(trip.exchangeRates),
    expectedWeather: parseJsonField<ExpectedWeather>(trip.expectedWeather),
    seasonalNotes: trip.seasonalNotes || undefined,
    timeZone: trip.timeZone || undefined,
    notes: trip.notes || undefined,
    sharingEnabled: trip.sharingEnabled,
    sharingLink: trip.sharingLink || undefined,
    isTemplate: trip.isTemplate,
    clonedFromTripId: trip.clonedFromTripId || undefined,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  }));
}

// Update a trip
export async function updateTrip(
  id: string,
  data: {
    name?: string;
    destination?: string;
    startDate?: Date;
    endDate?: Date;
    status?: TripStatus;
    budgetTotal?: number;
    currency?: string;
    travellers?: Traveller[];
    expectedWeather?: ExpectedWeather;
    exchangeRates?: ExchangeRates;
    seasonalNotes?: string;
    timeZone?: string;
    notes?: string;
    sharingEnabled?: boolean;
  }
): Promise<TripResponse> {
  const trip = await prisma.trip.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.destination && { destination: data.destination }),
      ...(data.startDate && { startDate: data.startDate }),
      ...(data.endDate && { endDate: data.endDate }),
      ...(data.status && { status: data.status }),
      ...(data.budgetTotal !== undefined && {
        budgetTotal: data.budgetTotal ? new Decimal(data.budgetTotal) : null,
      }),
      ...(data.currency && { currency: data.currency }),
      ...(data.travellers && { travellers: stringifyJsonField(data.travellers) }),
      ...(data.expectedWeather && {
        expectedWeather: stringifyJsonField(data.expectedWeather),
      }),
      ...(data.exchangeRates && {
        exchangeRates: stringifyJsonField(data.exchangeRates),
      }),
      ...(data.seasonalNotes !== undefined && { seasonalNotes: data.seasonalNotes }),
      ...(data.timeZone !== undefined && { timeZone: data.timeZone }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.sharingEnabled !== undefined && { sharingEnabled: data.sharingEnabled }),
    },
  });

  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    travellers: parseJsonField<Traveller[]>(trip.travellers),
    budgetTotal: decimalToNumber(trip.budgetTotal),
    currency: trip.currency,
    exchangeRates: parseJsonField<ExchangeRates>(trip.exchangeRates),
    expectedWeather: parseJsonField<ExpectedWeather>(trip.expectedWeather),
    seasonalNotes: trip.seasonalNotes || undefined,
    timeZone: trip.timeZone || undefined,
    notes: trip.notes || undefined,
    sharingEnabled: trip.sharingEnabled,
    sharingLink: trip.sharingLink || undefined,
    isTemplate: trip.isTemplate,
    clonedFromTripId: trip.clonedFromTripId || undefined,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

// Delete a trip
export async function deleteTrip(id: string): Promise<{ success: boolean; message: string }> {
  await prisma.trip.delete({
    where: { id },
  });

  return {
    success: true,
    message: 'Trip deleted successfully',
  };
}
