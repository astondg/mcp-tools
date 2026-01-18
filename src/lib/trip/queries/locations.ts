import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { LocationType, TripLocation } from '@prisma/client';
import { handleQueryError } from '@/lib/shared/errors';
import type { TripLocationResponse } from '../types';

/**
 * Convert Prisma Decimal to number
 */
function decimalToNumber(value: Decimal | null): number | undefined {
  return value ? value.toNumber() : undefined;
}

/**
 * Add a new location to a trip
 *
 * @param data - Location data
 * @returns The created location
 */
export async function addLocation(data: {
  tripId: string;
  type: LocationType;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  notes?: string;
}): Promise<TripLocationResponse> {
  try {
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
        placeId: data.placeId,
        notes: data.notes,
      },
    });

    return mapLocationToResponse(location);
  } catch (error) {
    throw handleQueryError(error, 'addLocation');
  }
}

/**
 * List locations for a trip with optional filters
 *
 * @param tripId - The trip ID
 * @param filters - Optional filters
 * @returns List of locations
 */
export async function listLocations(
  tripId: string,
  filters?: {
    type?: LocationType | LocationType[];
    city?: string;
    country?: string;
  }
): Promise<TripLocationResponse[]> {
  try {
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
  } catch (error) {
    throw handleQueryError(error, 'listLocations');
  }
}

/**
 * Update an existing location
 *
 * @param id - Location ID
 * @param data - Fields to update
 * @returns The updated location
 */
export async function updateLocation(
  id: string,
  data: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
    notes?: string;
  }
): Promise<TripLocationResponse> {
  try {
    const location = await prisma.tripLocation.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.latitude !== undefined && {
          latitude: data.latitude ? new Decimal(data.latitude) : null,
        }),
        ...(data.longitude !== undefined && {
          longitude: data.longitude ? new Decimal(data.longitude) : null,
        }),
        ...(data.placeId !== undefined && { placeId: data.placeId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    return mapLocationToResponse(location);
  } catch (error) {
    throw handleQueryError(error, 'updateLocation');
  }
}

/**
 * Delete a location
 *
 * @param id - Location ID
 * @returns Success status
 */
export async function deleteLocation(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.tripLocation.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    throw handleQueryError(error, 'deleteLocation');
  }
}

/**
 * Get nearby locations within a specified radius
 *
 * @param tripId - The trip ID
 * @param latitude - Center latitude
 * @param longitude - Center longitude
 * @param radiusKm - Search radius in kilometers (default: 5)
 * @returns List of nearby locations sorted by distance
 */
export async function getNearbyLocations(
  tripId: string,
  latitude: number,
  longitude: number,
  radiusKm: number = 5
): Promise<TripLocationResponse[]> {
  try {
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
  } catch (error) {
    throw handleQueryError(error, 'getNearbyLocations');
  }
}

/**
 * Calculate distance between two points using the Haversine formula
 *
 * @param lat1 - First point latitude
 * @param lon1 - First point longitude
 * @param lat2 - Second point latitude
 * @param lon2 - Second point longitude
 * @returns Distance in kilometers
 */
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

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Map Prisma TripLocation model to response type
 */
function mapLocationToResponse(location: TripLocation): TripLocationResponse {
  return {
    id: location.id,
    tripId: location.tripId,
    type: location.type,
    name: location.name,
    address: location.address ?? undefined,
    city: location.city ?? undefined,
    country: location.country ?? undefined,
    latitude: decimalToNumber(location.latitude),
    longitude: decimalToNumber(location.longitude),
    placeId: location.placeId ?? undefined,
    notes: location.notes ?? undefined,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}
