import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { PackingStatus } from '@prisma/client';
import type { TripPackingItemResponse } from '../types';

// Helper functions
function decimalToNumber(value: Decimal | null): number | undefined {
  return value ? value.toNumber() : undefined;
}

function stringifyJsonField<T>(value: T | undefined): string | undefined {
  if (!value) return undefined;
  return JSON.stringify(value);
}

function parseJsonField<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

// Add packing item
export async function addPackingItem(data: {
  tripId: string;
  name: string;
  category?: string;
  quantity?: number;
  status?: PackingStatus;
  purchasePrice?: number;
  currency?: string;
  purchaseUrl?: string;
  wishlistItemId?: string;
  budgetCategoryId?: string;
  assignedTo?: string;
  notes?: string;
}): Promise<TripPackingItemResponse> {
  const item = await prisma.tripPackingItem.create({
    data: {
      tripId: data.tripId,
      name: data.name,
      category: data.category,
      quantity: data.quantity || 1,
      status: data.status || PackingStatus.TO_BUY,
      purchasePrice: data.purchasePrice ? new Decimal(data.purchasePrice) : null,
      currency: data.currency || 'AUD',
      purchaseUrl: data.purchaseUrl,
      wishlistItemId: data.wishlistItemId,
      budgetCategoryId: data.budgetCategoryId,
      assignedTo: data.assignedTo,
      notes: data.notes,
    },
  });

  return mapPackingItemToResponse(item);
}

// List packing items with filters
export async function listPackingItems(
  tripId: string,
  filters?: {
    status?: PackingStatus | PackingStatus[];
    category?: string;
    assignedTo?: string;
  }
): Promise<TripPackingItemResponse[]> {
  const items = await prisma.tripPackingItem.findMany({
    where: {
      tripId,
      ...(filters?.status && {
        status: Array.isArray(filters.status) ? { in: filters.status } : filters.status,
      }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.assignedTo && { assignedTo: filters.assignedTo }),
    },
    orderBy: [{ status: 'asc' }, { category: 'asc' }, { name: 'asc' }],
  });

  return items.map(mapPackingItemToResponse);
}

// Update packing item
export async function updatePackingItem(
  id: string,
  data: {
    name?: string;
    category?: string;
    quantity?: number;
    status?: PackingStatus;
    purchasePrice?: number;
    purchaseUrl?: string;
    assignedTo?: string;
    notes?: string;
  }
): Promise<TripPackingItemResponse> {
  const item = await prisma.tripPackingItem.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.quantity && { quantity: data.quantity }),
      ...(data.status && { status: data.status }),
      ...(data.purchasePrice !== undefined && {
        purchasePrice: data.purchasePrice ? new Decimal(data.purchasePrice) : null,
      }),
      ...(data.purchaseUrl !== undefined && { purchaseUrl: data.purchaseUrl }),
      ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return mapPackingItemToResponse(item);
}

// Delete packing item
export async function deletePackingItem(id: string): Promise<{ success: boolean }> {
  await prisma.tripPackingItem.delete({ where: { id } });
  return { success: true };
}

// Bulk update status (mark multiple as packed)
export async function bulkUpdatePackingStatus(
  tripId: string,
  itemIds: string[],
  status: PackingStatus
): Promise<{ success: boolean; updated: number }> {
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
}

// Helper to map Prisma model to response type
function mapPackingItemToResponse(item: any): TripPackingItemResponse {
  return {
    id: item.id,
    tripId: item.tripId,
    name: item.name,
    category: item.category || undefined,
    quantity: item.quantity,
    status: item.status,
    purchasePrice: decimalToNumber(item.purchasePrice),
    currency: item.currency,
    purchaseUrl: item.purchaseUrl || undefined,
    wishlistItemId: item.wishlistItemId || undefined,
    budgetCategoryId: item.budgetCategoryId || undefined,
    assignedTo: item.assignedTo || undefined,
    notes: item.notes || undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
