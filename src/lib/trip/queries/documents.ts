import { prisma } from '@/lib/db';
import { DocumentType, TripDocument } from '@prisma/client';
import { handleQueryError } from '@/lib/shared/errors';
import type { TripDocumentResponse } from '../types';

/**
 * Add a new document to a trip
 *
 * @param data - Document data
 * @returns The created document
 */
export async function addDocument(data: {
  tripId: string;
  type: DocumentType;
  title: string;
  tripItemId?: string;
  travellerName?: string;
  fileUrl?: string;
  documentNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  notes?: string;
}): Promise<TripDocumentResponse> {
  try {
    const document = await prisma.tripDocument.create({
      data: {
        tripId: data.tripId,
        type: data.type,
        title: data.title,
        tripItemId: data.tripItemId,
        travellerName: data.travellerName,
        fileUrl: data.fileUrl,
        documentNumber: data.documentNumber,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        notes: data.notes,
      },
    });

    return mapDocumentToResponse(document);
  } catch (error) {
    throw handleQueryError(error, 'addDocument');
  }
}

/**
 * List documents for a trip with optional filters
 *
 * @param tripId - The trip ID
 * @param filters - Optional filters
 * @returns List of documents
 */
export async function listDocuments(
  tripId: string,
  filters?: {
    type?: DocumentType | DocumentType[];
    travellerName?: string;
    expiringWithinDays?: number;
  }
): Promise<TripDocumentResponse[]> {
  try {
    const futureDate = filters?.expiringWithinDays
      ? new Date(Date.now() + filters.expiringWithinDays * 24 * 60 * 60 * 1000)
      : undefined;

    const documents = await prisma.tripDocument.findMany({
      where: {
        tripId,
        ...(filters?.type && {
          type: Array.isArray(filters.type) ? { in: filters.type } : filters.type,
        }),
        ...(filters?.travellerName && { travellerName: filters.travellerName }),
        ...(futureDate && {
          expiryDate: {
            lte: futureDate,
            gte: new Date(),
          },
        }),
      },
      orderBy: [{ type: 'asc' }, { title: 'asc' }],
    });

    return documents.map(mapDocumentToResponse);
  } catch (error) {
    throw handleQueryError(error, 'listDocuments');
  }
}

/**
 * Update an existing document
 *
 * @param id - Document ID
 * @param data - Fields to update
 * @returns The updated document
 */
export async function updateDocument(
  id: string,
  data: {
    title?: string;
    travellerName?: string;
    fileUrl?: string;
    documentNumber?: string;
    issueDate?: Date;
    expiryDate?: Date;
    notes?: string;
  }
): Promise<TripDocumentResponse> {
  try {
    const document = await prisma.tripDocument.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.travellerName !== undefined && { travellerName: data.travellerName }),
        ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl }),
        ...(data.documentNumber !== undefined && { documentNumber: data.documentNumber }),
        ...(data.issueDate !== undefined && { issueDate: data.issueDate }),
        ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    return mapDocumentToResponse(document);
  } catch (error) {
    throw handleQueryError(error, 'updateDocument');
  }
}

/**
 * Delete a document
 *
 * @param id - Document ID
 * @returns Success status
 */
export async function deleteDocument(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.tripDocument.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    throw handleQueryError(error, 'deleteDocument');
  }
}

/**
 * Map Prisma TripDocument model to response type
 */
function mapDocumentToResponse(document: TripDocument): TripDocumentResponse {
  return {
    id: document.id,
    tripId: document.tripId,
    tripItemId: document.tripItemId ?? undefined,
    travellerName: document.travellerName ?? undefined,
    type: document.type,
    title: document.title,
    fileUrl: document.fileUrl ?? undefined,
    documentNumber: document.documentNumber ?? undefined,
    issueDate: document.issueDate ?? undefined,
    expiryDate: document.expiryDate ?? undefined,
    notes: document.notes ?? undefined,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
