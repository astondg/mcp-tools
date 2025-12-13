import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  VehicleResponse,
  ServiceRecordResponse,
  PartResponse,
  MaintenanceScheduleResponse,
  UpcomingMaintenanceItem,
} from './types';

// Helper to convert Decimal to number
function decimalToNumber(value: Decimal | null): number | null {
  return value ? value.toNumber() : null;
}

// ==========================================
// Vehicle Operations
// ==========================================

export async function createVehicle(data: {
  name: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  licensePlate?: string;
  currentOdometer?: number;
  notes?: string;
}): Promise<VehicleResponse> {
  const vehicle = await prisma.vehicle.create({
    data: {
      name: data.name,
      make: data.make,
      model: data.model,
      year: data.year,
      vin: data.vin,
      licensePlate: data.licensePlate,
      currentOdometer: data.currentOdometer ?? 0,
      notes: data.notes,
    },
  });
  return vehicle;
}

export async function updateVehicle(
  id: string,
  data: {
    name?: string;
    make?: string;
    model?: string;
    year?: number;
    vin?: string;
    licensePlate?: string;
    currentOdometer?: number;
    notes?: string;
  }
): Promise<VehicleResponse> {
  const vehicle = await prisma.vehicle.update({
    where: { id },
    data,
  });
  return vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  await prisma.vehicle.delete({
    where: { id },
  });
}

export async function getVehicles(): Promise<VehicleResponse[]> {
  return prisma.vehicle.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getVehicleById(id: string): Promise<VehicleResponse | null> {
  return prisma.vehicle.findUnique({
    where: { id },
  });
}

// ==========================================
// Service Record Operations
// ==========================================

export async function createServiceRecord(data: {
  vehicleId: string;
  serviceDate: Date;
  serviceType: string;
  odometer?: number;
  cost?: number;
  serviceTotalValue?: number;
  provider?: string;
  notes?: string;
  parts?: Array<{
    partId?: string;
    name?: string;
    manufacturer?: string;
    partNumber?: string;
    quantity?: number;
    costPerUnit?: number;
  }>;
  updateSchedule?: boolean;
}): Promise<ServiceRecordResponse> {
  // Start a transaction to create the service record, parts, and update schedules
  const result = await prisma.$transaction(async (tx) => {
    // Create the service record
    const serviceRecord = await tx.serviceRecord.create({
      data: {
        vehicleId: data.vehicleId,
        serviceDate: data.serviceDate,
        serviceType: data.serviceType,
        odometer: data.odometer,
        cost: data.cost,
        serviceTotalValue: data.serviceTotalValue,
        provider: data.provider,
        notes: data.notes,
      },
      include: {
        vehicle: true,
      },
    });

    // Create service parts if provided
    if (data.parts && data.parts.length > 0) {
      for (const partData of data.parts) {
        let partId = partData.partId;

        // Create new part if no partId provided
        if (!partId && partData.name) {
          const newPart = await tx.part.create({
            data: {
              name: partData.name,
              manufacturer: partData.manufacturer,
              partNumber: partData.partNumber,
              cost: partData.costPerUnit,
            },
          });
          partId = newPart.id;
        }

        if (partId) {
          await tx.servicePart.create({
            data: {
              serviceRecordId: serviceRecord.id,
              partId,
              quantity: partData.quantity ?? 1,
              costPerUnit: partData.costPerUnit,
            },
          });
        }
      }
    }

    // Auto-update matching maintenance schedule if enabled (default: true)
    if (data.updateSchedule !== false) {
      await tx.maintenanceSchedule.updateMany({
        where: {
          vehicleId: data.vehicleId,
          serviceType: data.serviceType,
          enabled: true,
        },
        data: {
          lastPerformedDate: data.serviceDate,
          lastPerformedOdometer: data.odometer,
        },
      });
    }

    // Also update vehicle odometer if service odometer is higher
    if (data.odometer) {
      await tx.vehicle.updateMany({
        where: {
          id: data.vehicleId,
          currentOdometer: { lt: data.odometer },
        },
        data: {
          currentOdometer: data.odometer,
        },
      });
    }

    return serviceRecord;
  });

  // Fetch the complete record with parts
  return getServiceRecordById(result.id) as Promise<ServiceRecordResponse>;
}

export async function getServiceRecordById(id: string): Promise<ServiceRecordResponse | null> {
  const record = await prisma.serviceRecord.findUnique({
    where: { id },
    include: {
      vehicle: true,
      serviceParts: {
        include: {
          part: true,
        },
      },
    },
  });

  if (!record) return null;

  return {
    id: record.id,
    vehicleId: record.vehicleId,
    vehicleName: record.vehicle.name,
    serviceDate: record.serviceDate,
    serviceType: record.serviceType,
    odometer: record.odometer,
    cost: decimalToNumber(record.cost),
    serviceTotalValue: decimalToNumber(record.serviceTotalValue),
    provider: record.provider,
    notes: record.notes,
    createdAt: record.createdAt,
    parts: record.serviceParts.map((sp) => ({
      id: sp.id,
      partId: sp.partId,
      partName: sp.part.name,
      partNumber: sp.part.partNumber,
      manufacturer: sp.part.manufacturer,
      quantity: sp.quantity,
      costPerUnit: decimalToNumber(sp.costPerUnit),
      notes: sp.notes,
    })),
  };
}

export async function getServiceHistory(filters: {
  vehicleId?: string;
  serviceType?: string;
  startDate?: Date;
  endDate?: Date;
  includeParts?: boolean;
  limit?: number;
}): Promise<ServiceRecordResponse[]> {
  const shouldIncludeParts = filters.includeParts !== false;

  const records = await prisma.serviceRecord.findMany({
    where: {
      vehicleId: filters.vehicleId,
      serviceType: filters.serviceType,
      serviceDate: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    },
    include: {
      vehicle: true,
      serviceParts: shouldIncludeParts ? {
        include: {
          part: true,
        },
      } : false,
    },
    orderBy: { serviceDate: 'desc' },
    take: filters.limit ?? 50,
  });

  return records.map((record) => {
    // Type assertion needed due to conditional include
    type ServicePartWithPart = {
      id: string;
      partId: string;
      quantity: number;
      costPerUnit: Decimal | null;
      notes: string | null;
      part: { name: string; partNumber: string | null; manufacturer: string | null };
    };
    const serviceParts = (record.serviceParts as unknown) as ServicePartWithPart[] | undefined;

    return {
      id: record.id,
      vehicleId: record.vehicleId,
      vehicleName: record.vehicle.name,
      serviceDate: record.serviceDate,
      serviceType: record.serviceType,
      odometer: record.odometer,
      cost: decimalToNumber(record.cost),
      serviceTotalValue: decimalToNumber(record.serviceTotalValue),
      provider: record.provider,
      notes: record.notes,
      createdAt: record.createdAt,
      parts: serviceParts ? serviceParts.map((sp) => ({
        id: sp.id,
        partId: sp.partId,
        partName: sp.part.name,
        partNumber: sp.part.partNumber,
        manufacturer: sp.part.manufacturer,
        quantity: sp.quantity,
        costPerUnit: decimalToNumber(sp.costPerUnit),
        notes: sp.notes,
      })) : undefined,
    };
  });
}

export async function updateServiceRecord(
  id: string,
  data: {
    serviceDate?: Date;
    serviceType?: string;
    odometer?: number;
    cost?: number;
    serviceTotalValue?: number;
    provider?: string;
    notes?: string;
  }
): Promise<ServiceRecordResponse> {
  await prisma.serviceRecord.update({
    where: { id },
    data,
  });
  return getServiceRecordById(id) as Promise<ServiceRecordResponse>;
}

export async function deleteServiceRecord(id: string): Promise<void> {
  await prisma.serviceRecord.delete({
    where: { id },
  });
}

// ==========================================
// Part Operations
// ==========================================

export async function createPart(data: {
  name: string;
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  description?: string;
  cost?: number;
  url?: string;
}): Promise<PartResponse> {
  const part = await prisma.part.create({
    data,
  });
  return {
    ...part,
    cost: decimalToNumber(part.cost),
  };
}

export async function getParts(filters: {
  search?: string;
  limit?: number;
}): Promise<PartResponse[]> {
  const parts = await prisma.part.findMany({
    where: filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { manufacturer: { contains: filters.search, mode: 'insensitive' } },
            { partNumber: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { name: 'asc' },
    take: filters.limit ?? 50,
  });

  return parts.map((part) => ({
    ...part,
    cost: decimalToNumber(part.cost),
  }));
}

// ==========================================
// Maintenance Schedule Operations
// ==========================================

export async function createMaintenanceSchedule(data: {
  vehicleId: string;
  name: string;
  serviceType: string;
  intervalKm?: number;
  intervalMonths?: number;
  lastPerformedDate?: Date;
  lastPerformedOdometer?: number;
  notes?: string;
}): Promise<MaintenanceScheduleResponse> {
  const schedule = await prisma.maintenanceSchedule.create({
    data,
    include: { vehicle: true },
  });
  return {
    ...schedule,
    vehicleName: schedule.vehicle.name,
  };
}

export async function updateMaintenanceSchedule(
  id: string,
  data: {
    name?: string;
    serviceType?: string;
    intervalKm?: number;
    intervalMonths?: number;
    lastPerformedDate?: Date;
    lastPerformedOdometer?: number;
    enabled?: boolean;
    notes?: string;
  }
): Promise<MaintenanceScheduleResponse> {
  const schedule = await prisma.maintenanceSchedule.update({
    where: { id },
    data,
    include: { vehicle: true },
  });
  return {
    ...schedule,
    vehicleName: schedule.vehicle.name,
  };
}

export async function deleteMaintenanceSchedule(id: string): Promise<void> {
  await prisma.maintenanceSchedule.delete({
    where: { id },
  });
}

export async function getMaintenanceSchedules(filters: {
  vehicleId: string;
  enabledOnly?: boolean;
}): Promise<MaintenanceScheduleResponse[]> {
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      vehicleId: filters.vehicleId,
      enabled: filters.enabledOnly !== false ? true : undefined,
    },
    include: { vehicle: true },
    orderBy: { name: 'asc' },
  });

  return schedules.map((schedule) => ({
    ...schedule,
    vehicleName: schedule.vehicle.name,
  }));
}

export async function getUpcomingMaintenance(filters: {
  vehicleId?: string;
  withinKm?: number;
  withinMonths?: number;
}): Promise<UpcomingMaintenanceItem[]> {
  const withinKm = filters.withinKm ?? 1000;
  const withinMonths = filters.withinMonths ?? 1;

  // Get all enabled schedules with vehicle info
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      vehicleId: filters.vehicleId,
      enabled: true,
    },
    include: { vehicle: true },
  });

  const now = new Date();
  const results: UpcomingMaintenanceItem[] = [];

  for (const schedule of schedules) {
    const currentOdometer = schedule.vehicle.currentOdometer;
    let kmUntilDue: number | null = null;
    let kmOverdue: number | null = null;
    let daysUntilDue: number | null = null;
    let daysOverdue: number | null = null;
    let nextDueOdometer: number | null = null;
    let nextDueDate: Date | null = null;
    let status: 'overdue' | 'due_soon' | 'upcoming' = 'upcoming';

    let isOverdueByKm = false;
    let isDueSoonByKm = false;
    let isOverdueByTime = false;
    let isDueSoonByTime = false;

    // Calculate km-based due
    if (schedule.intervalKm && schedule.lastPerformedOdometer !== null) {
      nextDueOdometer = schedule.lastPerformedOdometer + schedule.intervalKm;
      const kmRemaining = nextDueOdometer - currentOdometer;

      if (kmRemaining <= 0) {
        kmOverdue = Math.abs(kmRemaining);
        isOverdueByKm = true;
      } else if (kmRemaining <= withinKm) {
        kmUntilDue = kmRemaining;
        isDueSoonByKm = true;
      } else {
        kmUntilDue = kmRemaining;
      }
    }

    // Calculate time-based due
    if (schedule.intervalMonths && schedule.lastPerformedDate) {
      const lastDate = new Date(schedule.lastPerformedDate);
      nextDueDate = new Date(lastDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + schedule.intervalMonths);

      const msRemaining = nextDueDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 0) {
        daysOverdue = Math.abs(daysRemaining);
        isOverdueByTime = true;
      } else if (daysRemaining <= withinMonths * 30) {
        daysUntilDue = daysRemaining;
        isDueSoonByTime = true;
      } else {
        daysUntilDue = daysRemaining;
      }
    }

    // Determine overall status (overdue takes precedence)
    if (isOverdueByKm || isOverdueByTime) {
      status = 'overdue';
    } else if (isDueSoonByKm || isDueSoonByTime) {
      status = 'due_soon';
    }

    // Only include if overdue or due soon
    if (status === 'overdue' || status === 'due_soon') {
      results.push({
        scheduleId: schedule.id,
        vehicleId: schedule.vehicleId,
        vehicleName: schedule.vehicle.name,
        name: schedule.name,
        serviceType: schedule.serviceType,
        status,
        kmUntilDue,
        kmOverdue,
        daysUntilDue,
        daysOverdue,
        lastPerformedDate: schedule.lastPerformedDate,
        lastPerformedOdometer: schedule.lastPerformedOdometer,
        nextDueOdometer,
        nextDueDate,
      });
    }
  }

  // Sort: overdue first, then by urgency
  return results.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (a.status !== 'overdue' && b.status === 'overdue') return 1;

    // Within same status, sort by most urgent
    const aUrgency = Math.min(
      a.kmUntilDue ?? Infinity,
      (a.daysUntilDue ?? Infinity) * 100 // Weight days more
    );
    const bUrgency = Math.min(
      b.kmUntilDue ?? Infinity,
      (b.daysUntilDue ?? Infinity) * 100
    );
    return aUrgency - bUrgency;
  });
}
