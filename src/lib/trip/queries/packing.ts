import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { PackingStatus, PackingCategory, PackingPriority, TripPackingItem } from '@prisma/client';
import { handleQueryError, validationError } from '@/lib/shared/errors';
import type { TripPackingItemResponse } from '../types';

/**
 * Convert Prisma Decimal to number
 */
function decimalToNumber(value: Decimal | null): number | undefined {
  return value ? value.toNumber() : undefined;
}

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
 * Validate and convert string to PackingCategory enum
 * @throws {McpToolError} if category is invalid
 */
function validatePackingCategory(category: string | undefined): PackingCategory {
  if (!category) {
    return PackingCategory.OTHER;
  }

  const validCategories = Object.values(PackingCategory);
  if (!validCategories.includes(category as PackingCategory)) {
    throw validationError(
      `Invalid packing category: '${category}'. Valid values: ${validCategories.join(', ')}`
    );
  }

  return category as PackingCategory;
}

/**
 * Add a new packing item to a trip
 *
 * @param data - Packing item data
 * @returns The created packing item
 */
export async function addPackingItem(data: {
  tripId: string;
  name: string;
  category?: string;
  quantity?: number;
  status?: PackingStatus;
  priority?: PackingPriority;
  purchasePrice?: number;
  currency?: string;
  purchaseUrl?: string;
  purchaseDeadline?: Date;
  wishlistItemId?: string;
  notes?: string;
  tags?: string[];
}): Promise<TripPackingItemResponse> {
  try {
    const item = await prisma.tripPackingItem.create({
      data: {
        tripId: data.tripId,
        item: data.name,
        category: validatePackingCategory(data.category),
        quantity: data.quantity ?? 1,
        status: data.status ?? PackingStatus.OWNED,
        priority: data.priority ?? PackingPriority.ESSENTIAL,
        purchasePrice: data.purchasePrice ? new Decimal(data.purchasePrice) : null,
        currency: data.currency ?? 'AUD',
        purchaseUrl: data.purchaseUrl,
        purchaseDeadline: data.purchaseDeadline,
        wishlistItemId: data.wishlistItemId,
        notes: data.notes,
        tags: data.tags ? JSON.stringify(data.tags) : null,
      },
    });

    return mapPackingItemToResponse(item);
  } catch (error) {
    throw handleQueryError(error, 'addPackingItem');
  }
}

/**
 * List packing items for a trip with optional filters
 *
 * @param tripId - The trip ID
 * @param filters - Optional filters
 * @returns List of packing items
 */
export async function listPackingItems(
  tripId: string,
  filters?: {
    status?: PackingStatus | PackingStatus[];
    category?: string;
  }
): Promise<TripPackingItemResponse[]> {
  try {
    const items = await prisma.tripPackingItem.findMany({
      where: {
        tripId,
        ...(filters?.status && {
          status: Array.isArray(filters.status) ? { in: filters.status } : filters.status,
        }),
        ...(filters?.category && { category: validatePackingCategory(filters.category) }),
      },
      orderBy: [{ status: 'asc' }, { category: 'asc' }, { item: 'asc' }],
    });

    return items.map(mapPackingItemToResponse);
  } catch (error) {
    throw handleQueryError(error, 'listPackingItems');
  }
}

/**
 * Update an existing packing item
 *
 * @param id - Packing item ID
 * @param data - Fields to update
 * @returns The updated packing item
 */
export async function updatePackingItem(
  id: string,
  data: {
    name?: string;
    category?: string;
    quantity?: number;
    status?: PackingStatus;
    priority?: PackingPriority;
    purchasePrice?: number;
    purchaseUrl?: string;
    purchaseDeadline?: Date;
    notes?: string;
    tags?: string[];
  }
): Promise<TripPackingItemResponse> {
  try {
    const item = await prisma.tripPackingItem.update({
      where: { id },
      data: {
        ...(data.name && { item: data.name }),
        ...(data.category !== undefined && { category: validatePackingCategory(data.category) }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.status && { status: data.status }),
        ...(data.priority && { priority: data.priority }),
        ...(data.purchasePrice !== undefined && {
          purchasePrice: data.purchasePrice ? new Decimal(data.purchasePrice) : null,
        }),
        ...(data.purchaseUrl !== undefined && { purchaseUrl: data.purchaseUrl }),
        ...(data.purchaseDeadline !== undefined && { purchaseDeadline: data.purchaseDeadline }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.tags !== undefined && { tags: data.tags ? JSON.stringify(data.tags) : null }),
      },
    });

    return mapPackingItemToResponse(item);
  } catch (error) {
    throw handleQueryError(error, 'updatePackingItem');
  }
}

/**
 * Delete a packing item
 *
 * @param id - Packing item ID
 * @returns Success status
 */
export async function deletePackingItem(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.tripPackingItem.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    throw handleQueryError(error, 'deletePackingItem');
  }
}

/**
 * Bulk update status for multiple packing items
 *
 * @param tripId - The trip ID
 * @param itemIds - Array of item IDs to update
 * @param status - New status to set
 * @returns Success status and count of updated items
 */
export async function bulkUpdatePackingStatus(
  tripId: string,
  itemIds: string[],
  status: PackingStatus
): Promise<{ success: boolean; updated: number }> {
  try {
    const result = await prisma.tripPackingItem.updateMany({
      where: {
        tripId,
        id: { in: itemIds },
      },
      data: { status },
    });

    return {
      success: true,
      updated: result.count,
    };
  } catch (error) {
    throw handleQueryError(error, 'bulkUpdatePackingStatus');
  }
}

/**
 * Map Prisma TripPackingItem model to response type
 */
function mapPackingItemToResponse(item: TripPackingItem): TripPackingItemResponse {
  return {
    id: item.id,
    tripId: item.tripId,
    category: item.category,
    item: item.item,
    quantity: item.quantity,
    status: item.status,
    priority: item.priority,
    purchaseUrl: item.purchaseUrl ?? undefined,
    purchasePrice: decimalToNumber(item.purchasePrice),
    currency: item.currency,
    purchaseDeadline: item.purchaseDeadline ?? undefined,
    wishlistItemId: item.wishlistItemId ?? undefined,
    notes: item.notes ?? undefined,
    tags: parseJsonField<string[]>(item.tags),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
