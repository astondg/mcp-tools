import { prisma } from '@/lib/db';
import { DocumentType } from '@prisma/client';
import type { TripDocumentResponse } from '../types';

// Add document
export async function addDocument(data: {
  tripId: string;
  type: DocumentType;
  name: string;
  description?: string;
  documentNumber?: string;
  expiryDate?: Date;
  issueDate?: Date;
  issuingAuthority?: string;
  fileUrl?: string;
  status?: string;
  assignedTo?: string;
  notes?: string;
}): Promise<TripDocumentResponse> {
  const document = await prisma.tripDocument.create({
    data: {
      tripId: data.tripId,
      type: data.type,
      title: data.name, // Schema uses 'title' not 'name'
      travellerName: data.assignedTo, // Schema uses 'travellerName' not 'assignedTo'
      documentNumber: data.documentNumber,
      expiryDate: data.expiryDate,
      issueDate: data.issueDate,
      fileUrl: data.fileUrl,
      notes: data.notes,
    },
  });

  return mapDocumentToResponse(document);
}

// List documents with filters
export async function listDocuments(
  tripId: string,
  filters?: {
    type?: DocumentType | DocumentType[];
    status?: string;
    assignedTo?: string;
    expiringWithinDays?: number;
  }
): Promise<TripDocumentResponse[]> {
  const futureDate = filters?.expiringWithinDays
    ? new Date(Date.now() + filters.expiringWithinDays * 24 * 60 * 60 * 1000)
    : undefined;

  const documents = await prisma.tripDocument.findMany({
    where: {
      tripId,
      ...(filters?.type && {
        type: Array.isArray(filters.type) ? { in: filters.type } : filters.type,
      }),
      ...(filters?.assignedTo && { travellerName: filters.assignedTo }), // Schema uses 'travellerName'
      ...(futureDate && {
        expiryDate: {
          lte: futureDate,
          gte: new Date(),
        },
      }),
    },
    orderBy: [{ type: 'asc' }, { title: 'asc' }], // Schema uses 'title'
  });

  return documents.map(mapDocumentToResponse);
}

// Update document
export async function updateDocument(
  id: string,
  data: {
    name?: string;
    description?: string;
    documentNumber?: string;
    expiryDate?: Date;
    issueDate?: Date;
    issuingAuthority?: string;
    fileUrl?: string;
    status?: string;
    notes?: string;
  }
): Promise<TripDocumentResponse> {
  const document = await prisma.tripDocument.update({
    where: { id },
    data: {
      ...(data.name && { title: data.name }), // Schema uses 'title'
      ...(data.documentNumber !== undefined && { documentNumber: data.documentNumber }),
      ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate }),
      ...(data.issueDate !== undefined && { issueDate: data.issueDate }),
      ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return mapDocumentToResponse(document);
}

// Delete document
export async function deleteDocument(id: string): Promise<{ success: boolean }> {
  await prisma.tripDocument.delete({ where: { id } });
  return { success: true };
}

// Helper to map Prisma model to response type
function mapDocumentToResponse(document: any): TripDocumentResponse {
  return {
    id: document.id,
    tripId: document.tripId,
    type: document.type,
    name: document.title, // Map title back to name
    description: undefined, // Schema doesn't have description
    documentNumber: document.documentNumber || undefined,
    expiryDate: document.expiryDate || undefined,
    issueDate: document.issueDate || undefined,
    issuingAuthority: undefined, // Schema doesn't have issuingAuthority
    fileUrl: document.fileUrl || undefined,
    status: undefined, // Schema doesn't have status
    assignedTo: document.travellerName || undefined, // Map travellerName back to assignedTo
    notes: document.notes || undefined,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
