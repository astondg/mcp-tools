import { prisma } from '@/lib/db';
import type { TripNoteResponse } from '../types';

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

// Add note
export async function addNote(data: {
  tripId: string;
  tripItemId?: string;
  title: string;
  content: string;
  noteDate?: Date;
  tags?: string[];
  isPinned?: boolean;
  attachments?: Array<{ name: string; url: string; type?: string }>;
}): Promise<TripNoteResponse> {
  const note = await prisma.tripNote.create({
    data: {
      tripId: data.tripId,
      tripItemId: data.tripItemId,
      title: data.title,
      content: data.content,
      noteDate: data.noteDate || new Date(),
      tags: stringifyJsonField(data.tags),
      isPinned: data.isPinned || false,
      attachments: stringifyJsonField(data.attachments),
    },
  });

  return mapNoteToResponse(note);
}

// List notes with filters
export async function listNotes(
  tripId: string,
  filters?: {
    tripItemId?: string;
    tag?: string;
    pinnedOnly?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    searchTerm?: string;
  }
): Promise<TripNoteResponse[]> {
  const notes = await prisma.tripNote.findMany({
    where: {
      tripId,
      ...(filters?.tripItemId && { tripItemId: filters.tripItemId }),
      ...(filters?.tag && { tags: { contains: filters.tag } }),
      ...(filters?.pinnedOnly && { isPinned: true }),
      ...(filters?.dateFrom && { noteDate: { gte: filters.dateFrom } }),
      ...(filters?.dateTo && { noteDate: { lte: filters.dateTo } }),
      ...(filters?.searchTerm && {
        OR: [
          { title: { contains: filters.searchTerm, mode: 'insensitive' } },
          { content: { contains: filters.searchTerm, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: [{ isPinned: 'desc' }, { noteDate: 'desc' }],
  });

  return notes.map(mapNoteToResponse);
}

// Update note
export async function updateNote(
  id: string,
  data: {
    title?: string;
    content?: string;
    noteDate?: Date;
    tags?: string[];
    isPinned?: boolean;
    attachments?: Array<{ name: string; url: string; type?: string }>;
  }
): Promise<TripNoteResponse> {
  const note = await prisma.tripNote.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.content && { content: data.content }),
      ...(data.noteDate && { noteDate: data.noteDate }),
      ...(data.tags && { tags: stringifyJsonField(data.tags) }),
      ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
      ...(data.attachments && { attachments: stringifyJsonField(data.attachments) }),
    },
  });

  return mapNoteToResponse(note);
}

// Delete note
export async function deleteNote(id: string): Promise<{ success: boolean }> {
  await prisma.tripNote.delete({ where: { id } });
  return { success: true };
}

// Helper to map Prisma model to response type
function mapNoteToResponse(note: any): TripNoteResponse {
  return {
    id: note.id,
    tripId: note.tripId,
    tripItemId: note.tripItemId || undefined,
    title: note.title,
    content: note.content,
    noteDate: note.noteDate,
    tags: parseJsonField<string[]>(note.tags),
    isPinned: note.isPinned,
    attachments: parseJsonField<Array<{ name: string; url: string; type?: string }>>(
      note.attachments
    ),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
