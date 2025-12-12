// Standard service types for maintenance tracking
export const SERVICE_TYPES = [
  'oil_change',
  'tire_rotation',
  'tire_replacement',
  'brake_pads',
  'brake_rotors',
  'air_filter',
  'cabin_filter',
  'spark_plugs',
  'coolant_flush',
  'transmission_fluid',
  'battery_replacement',
  'wiper_blades',
  'alignment',
  'timing_belt',
  'serpentine_belt',
  'suspension',
  'full_service',
  'inspection',
  'registration',
  'insurance',
  'other',
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

// Helper to validate service type
export function isValidServiceType(type: string): type is ServiceType {
  return SERVICE_TYPES.includes(type as ServiceType);
}

// Response types for tool outputs
export interface VehicleResponse {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  licensePlate: string | null;
  currentOdometer: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceRecordResponse {
  id: string;
  vehicleId: string;
  vehicleName?: string;
  serviceDate: Date;
  serviceType: string;
  odometer: number | null;
  cost: number | null;
  provider: string | null;
  notes: string | null;
  createdAt: Date;
  parts?: ServicePartResponse[];
}

export interface PartResponse {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  partNumber: string | null;
  description: string | null;
  cost: number | null;
  url: string | null;
  createdAt: Date;
}

export interface ServicePartResponse {
  id: string;
  partId: string;
  partName: string;
  partNumber: string | null;
  manufacturer: string | null;
  quantity: number;
  costPerUnit: number | null;
  notes: string | null;
}

export interface MaintenanceScheduleResponse {
  id: string;
  vehicleId: string;
  vehicleName?: string;
  name: string;
  serviceType: string;
  intervalKm: number | null;
  intervalMonths: number | null;
  lastPerformedDate: Date | null;
  lastPerformedOdometer: number | null;
  enabled: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface UpcomingMaintenanceItem {
  scheduleId: string;
  vehicleId: string;
  vehicleName: string;
  name: string;
  serviceType: string;
  status: 'overdue' | 'due_soon' | 'upcoming';
  // For km-based
  kmUntilDue: number | null;
  kmOverdue: number | null;
  // For time-based
  daysUntilDue: number | null;
  daysOverdue: number | null;
  // Last performed info
  lastPerformedDate: Date | null;
  lastPerformedOdometer: number | null;
  // Next due targets
  nextDueOdometer: number | null;
  nextDueDate: Date | null;
}
