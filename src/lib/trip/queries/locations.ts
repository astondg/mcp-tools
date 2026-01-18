import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { LocationType } from '@prisma/client';
import type { TripLocationResponse } from '../types';

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

// Add location
export async function addLocation(data: {
  tripId: string;
  type: LocationType;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
  notes?: string;
  customFields?: Record<string, any>;
}): Promise<TripLocationResponse> {
  const location = await prisma.tripLocation.create({
    data: {
      tripId: data.tripId,
      type: data.type,
      name: data.name,
      address: data.address,
      city: data.city,
      country: data.country,
      latitude: data.latitude ? new Decimal(data.latitude) : null,
      longitude: data.longitude ? new Decimal(data.longitude) : null,
      googleMapsUrl: data.googleMapsUrl,
      website: data.website,
      phone: data.phone,
      openingHours: data.openingHours,
      notes: data.notes,
      customFields: stringifyJsonField(data.customFields),
    },
  });

  return mapLocationToResponse(location);
}

// List locations with filters
export async function listLocations(
  tripId: string,
  filters?: {
    type?: LocationType | LocationType[];
    city?: string;
    country?: string;
  }
): Promise<TripLocationResponse[]> {
  const locations = await prisma.tripLocation.findMany({
    where: {
      tripId,
      ...(filters?.type && {
        type: Array.isArray(filters.type) ? { in: filters.type } : filters.type,
      }),
      ...(filters?.city && { city: filters.city }),
      ...(filters?.country && { country: filters.country }),
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  return locations.map(mapLocationToResponse);
}

// Get nearby locations (within distance in km)
export async function getNearbyLocations(
  tripId: string,
  latitude: number,
  longitude: number,
  radiusKm: number = 5
): Promise<TripLocationResponse[]> {
  // Get all locations with coordinates
  const locations = await prisma.tripLocation.findMany({
    where: {
      tripId,
      latitude: { not: null },
      longitude: { not: null },
    },
  });

  // Calculate distance and filter
  const nearby = locations
    .map((loc) => {
      const lat = decimalToNumber(loc.latitude)!;
      const lon = decimalToNumber(loc.longitude)!;
      const distance = calculateDistance(latitude, longitude, lat, lon);
      return { location: loc, distance };
    })
    .filter((item) => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => mapLocationToResponse(item.location));

  return nearby;
}

// Haversine formula to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Helper to map Prisma model to response type
function mapLocationToResponse(location: any): TripLocationResponse {
  return {
    id: location.id,
    tripId: location.tripId,
    type: location.type,
    name: location.name,
    address: location.address || undefined,
    city: location.city || undefined,
    country: location.country || undefined,
    latitude: decimalToNumber(location.latitude),
    longitude: decimalToNumber(location.longitude),
    googleMapsUrl: location.googleMapsUrl || undefined,
    website: location.website || undefined,
    phone: location.phone || undefined,
    openingHours: location.openingHours || undefined,
    notes: location.notes || undefined,
    customFields: parseJsonField<Record<string, any>>(location.customFields),
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}
