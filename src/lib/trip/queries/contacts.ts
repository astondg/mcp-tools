import { prisma } from '@/lib/db';
import { ContactType, TripContact } from '@prisma/client';
import { notFoundError, handleQueryError } from '@/lib/shared/errors';
import type { TripContactResponse } from '../types';

/**
 * Add a new contact to a trip
 *
 * @param data - Contact data
 * @returns The created contact
 */
export async function addContact(data: {
  tripId: string;
  type: ContactType;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isEmergency?: boolean;
  notes?: string;
}): Promise<TripContactResponse> {
  try {
    const contact = await prisma.tripContact.create({
      data: {
        tripId: data.tripId,
        type: data.type,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        isEmergency: data.isEmergency ?? false,
        notes: data.notes,
      },
    });

    return mapContactToResponse(contact);
  } catch (error) {
    throw handleQueryError(error, 'addContact');
  }
}

/**
 * List contacts for a trip with optional filters
 *
 * @param tripId - The trip ID
 * @param filters - Optional filters
 * @returns List of contacts
 */
export async function listContacts(
  tripId: string,
  filters?: {
    type?: ContactType | ContactType[];
    emergencyOnly?: boolean;
  }
): Promise<TripContactResponse[]> {
  try {
    const contacts = await prisma.tripContact.findMany({
      where: {
        tripId,
        ...(filters?.type && {
          type: Array.isArray(filters.type) ? { in: filters.type } : filters.type,
        }),
        ...(filters?.emergencyOnly && { isEmergency: true }),
      },
      orderBy: [{ isEmergency: 'desc' }, { type: 'asc' }, { name: 'asc' }],
    });

    return contacts.map(mapContactToResponse);
  } catch (error) {
    throw handleQueryError(error, 'listContacts');
  }
}

/**
 * Update an existing contact
 *
 * @param id - Contact ID
 * @param data - Fields to update
 * @returns The updated contact
 */
export async function updateContact(
  id: string,
  data: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    isEmergency?: boolean;
    notes?: string;
  }
): Promise<TripContactResponse> {
  try {
    const contact = await prisma.tripContact.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.isEmergency !== undefined && { isEmergency: data.isEmergency }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    return mapContactToResponse(contact);
  } catch (error) {
    throw handleQueryError(error, 'updateContact');
  }
}

/**
 * Delete a contact
 *
 * @param id - Contact ID
 * @returns Success status
 */
export async function deleteContact(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.tripContact.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    throw handleQueryError(error, 'deleteContact');
  }
}

/**
 * Map Prisma TripContact model to response type
 */
function mapContactToResponse(contact: TripContact): TripContactResponse {
  return {
    id: contact.id,
    tripId: contact.tripId,
    type: contact.type,
    name: contact.name,
    phone: contact.phone ?? undefined,
    email: contact.email ?? undefined,
    address: contact.address ?? undefined,
    isEmergency: contact.isEmergency,
    notes: contact.notes ?? undefined,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}
