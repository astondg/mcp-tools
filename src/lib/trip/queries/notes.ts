import { prisma } from '@/lib/db';
import { TripNote } from '@prisma/client';
import { handleQueryError } from '@/lib/shared/errors';
import type { TripNoteResponse } from '../types';

/**
 * Parse JSON string field to typed value
 */
function parseJsonField<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Add a new note to a trip
 *
 * @param data - Note data
 * @returns The created note
 */
export async function addNote(data: {
  tripId: string;
  tripItemId?: string;
  title?: string;
  content: string;
  tags?: string[];
}): Promise<TripNoteResponse> {
  try {
    const note = await prisma.tripNote.create({
      data: {
        tripId: data.tripId,
        tripItemId: data.tripItemId,
        title: data.title,
        content: data.content,
        tags: data.tags ? JSON.stringify(data.tags) : null,
      },
    });

    return mapNoteToResponse(note);
  } catch (error) {
    throw handleQueryError(error, 'addNote');
  }
}

/**
 * List notes for a trip with optional filters
 *
 * @param tripId - The trip ID
 * @param filters - Optional filters
 * @returns List of notes
 */
export async function listNotes(
  tripId: string,
  filters?: {
    tripItemId?: string;
    tag?: string;
    dateFrom?: Date;
    dateTo?: Date;
    searchTerm?: string;
  }
): Promise<TripNoteResponse[]> {
  try {
    const notes = await prisma.tripNote.findMany({
      where: {
        tripId,
        ...(filters?.tripItemId && { tripItemId: filters.tripItemId }),
        ...(filters?.tag && { tags: { contains: filters.tag } }),
        ...(filters?.dateFrom && { createdAt: { gte: filters.dateFrom } }),
        ...(filters?.dateTo && { createdAt: { lte: filters.dateTo } }),
        ...(filters?.searchTerm && {
          OR: [
            { title: { contains: filters.searchTerm, mode: 'insensitive' as const } },
            { content: { contains: filters.searchTerm, mode: 'insensitive' as const } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return notes.map(mapNoteToResponse);
  } catch (error) {
    throw handleQueryError(error, 'listNotes');
  }
}

/**
 * Update an existing note
 *
 * @param id - Note ID
 * @param data - Fields to update
 * @returns The updated note
 */
export async function updateNote(
  id: string,
  data: {
    title?: string;
    content?: string;
    tags?: string[];
  }
): Promise<TripNoteResponse> {
  try {
    const note = await prisma.tripNote.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content && { content: data.content }),
        ...(data.tags !== undefined && { tags: data.tags ? JSON.stringify(data.tags) : null }),
      },
    });

    return mapNoteToResponse(note);
  } catch (error) {
    throw handleQueryError(error, 'updateNote');
  }
}

/**
 * Delete a note
 *
 * @param id - Note ID
 * @returns Success status
 */
export async function deleteNote(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.tripNote.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    throw handleQueryError(error, 'deleteNote');
  }
}

/**
 * Map Prisma TripNote model to response type
 */
function mapNoteToResponse(note: TripNote): TripNoteResponse {
  return {
    id: note.id,
    tripId: note.tripId,
    tripItemId: note.tripItemId ?? undefined,
    title: note.title ?? undefined,
    content: note.content,
    noteType: note.noteType,
    tags: parseJsonField<string[]>(note.tags),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
