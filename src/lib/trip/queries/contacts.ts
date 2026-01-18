import { prisma } from '@/lib/db';
import { ContactType } from '@prisma/client';
import type { TripContactResponse } from '../types';

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

// Add contact
export async function addContact(data: {
  tripId: string;
  type: ContactType;
  name: string;
  organization?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  emergencyContact?: boolean;
  notes?: string;
  customFields?: Record<string, any>;
}): Promise<TripContactResponse> {
  const contact = await prisma.tripContact.create({
    data: {
      tripId: data.tripId,
      type: data.type,
      name: data.name,
      organization: data.organization,
      phone: data.phone,
      email: data.email,
      address: data.address,
      website: data.website,
      emergencyContact: data.emergencyContact || false,
      notes: data.notes,
      customFields: stringifyJsonField(data.customFields),
    },
  });

  return mapContactToResponse(contact);
}

// List contacts with filters
export async function listContacts(
  tripId: string,
  filters?: {
    type?: ContactType | ContactType[];
    emergencyOnly?: boolean;
  }
): Promise<TripContactResponse[]> {
  const contacts = await prisma.tripContact.findMany({
    where: {
      tripId,
      ...(filters?.type && {
        type: Array.isArray(filters.type) ? { in: filters.type } : filters.type,
      }),
      ...(filters?.emergencyOnly && { emergencyContact: true }),
    },
    orderBy: [{ emergencyContact: 'desc' }, { type: 'asc' }, { name: 'asc' }],
  });

  return contacts.map(mapContactToResponse);
}

// Update contact
export async function updateContact(
  id: string,
  data: {
    name?: string;
    organization?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    emergencyContact?: boolean;
    notes?: string;
    customFields?: Record<string, any>;
  }
): Promise<TripContactResponse> {
  const contact = await prisma.tripContact.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.organization !== undefined && { organization: data.organization }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.emergencyContact !== undefined && { emergencyContact: data.emergencyContact }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.customFields && { customFields: stringifyJsonField(data.customFields) }),
    },
  });

  return mapContactToResponse(contact);
}

// Delete contact
export async function deleteContact(id: string): Promise<{ success: boolean }> {
  await prisma.tripContact.delete({ where: { id } });
  return { success: true };
}

// Helper to map Prisma model to response type
function mapContactToResponse(contact: any): TripContactResponse {
  return {
    id: contact.id,
    tripId: contact.tripId,
    type: contact.type,
    name: contact.name,
    organization: contact.organization || undefined,
    phone: contact.phone || undefined,
    email: contact.email || undefined,
    address: contact.address || undefined,
    website: contact.website || undefined,
    emergencyContact: contact.emergencyContact,
    notes: contact.notes || undefined,
    customFields: parseJsonField<Record<string, any>>(contact.customFields),
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}
