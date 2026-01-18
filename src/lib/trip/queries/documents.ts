import { prisma } from '@/lib/db';
import { DocumentType, DocumentStatus } from '@prisma/client';
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
  status?: DocumentStatus;
  assignedTo?: string;
  notes?: string;
}): Promise<TripDocumentResponse> {
  const document = await prisma.tripDocument.create({
    data: {
      tripId: data.tripId,
      type: data.type,
      name: data.name,
      description: data.description,
      documentNumber: data.documentNumber,
      expiryDate: data.expiryDate,
      issueDate: data.issueDate,
      issuingAuthority: data.issuingAuthority,
      fileUrl: data.fileUrl,
      status: data.status || DocumentStatus.PENDING,
      assignedTo: data.assignedTo,
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
    status?: DocumentStatus;
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
      ...(filters?.status && { status: filters.status }),
      ...(filters?.assignedTo && { assignedTo: filters.assignedTo }),
      ...(futureDate && {
        expiryDate: {
          lte: futureDate,
          gte: new Date(),
        },
      }),
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
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
    status?: DocumentStatus;
    notes?: string;
  }
): Promise<TripDocumentResponse> {
  const document = await prisma.tripDocument.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.documentNumber !== undefined && { documentNumber: data.documentNumber }),
      ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate }),
      ...(data.issueDate !== undefined && { issueDate: data.issueDate }),
      ...(data.issuingAuthority !== undefined && {
        issuingAuthority: data.issuingAuthority,
      }),
      ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl }),
      ...(data.status && { status: data.status }),
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
    name: document.name,
    description: document.description || undefined,
    documentNumber: document.documentNumber || undefined,
    expiryDate: document.expiryDate || undefined,
    issueDate: document.issueDate || undefined,
    issuingAuthority: document.issuingAuthority || undefined,
    fileUrl: document.fileUrl || undefined,
    status: document.status,
    assignedTo: document.assignedTo || undefined,
    notes: document.notes || undefined,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
