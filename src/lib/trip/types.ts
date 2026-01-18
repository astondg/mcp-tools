import {
  TripStatus,
  TripItemType,
  TripItemStatus,
  TripItemPriority,
  PackingCategory,
  PackingStatus,
  PackingPriority,
  ItineraryStatus,
  TimeSlot,
  DayPace,
  ReminderStatus,
  DocumentType,
  ContactType,
  LocationType,
} from '@prisma/client';

// Re-export enums for convenience
export {
  TripStatus,
  TripItemType,
  TripItemStatus,
  TripItemPriority,
  PackingCategory,
  PackingStatus,
  PackingPriority,
  ItineraryStatus,
  TimeSlot,
  DayPace,
  ReminderStatus,
  DocumentType,
  ContactType,
  LocationType,
};

// Traveller information
export interface Traveller {
  name: string;
  age?: number;
  birthday?: string; // YYYY-MM-DD
  notes?: string;
}

// Weather information
export interface ExpectedWeather {
  tempLow: number;
  tempHigh: number;
  conditions: string; // "Cold, rainy", "Sunny"
  notes?: string;
}

// Exchange rate information
export interface ExchangeRate {
  rate: number;
  updatedAt: string;
}

export interface ExchangeRates {
  [currency: string]: ExchangeRate;
}

// Checklist item for reminders
export interface ChecklistItem {
  text: string;
  completed: boolean;
}

// Response types for MCP tools
export interface TripResponse {
  id: string;
  name: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  status: TripStatus;
  travellers?: Traveller[];
  budgetTotal?: number;
  currency: string;
  exchangeRates?: ExchangeRates;
  expectedWeather?: ExpectedWeather;
  seasonalNotes?: string;
  timeZone?: string;
  notes?: string;
  sharingEnabled: boolean;
  sharingLink?: string;
  isTemplate: boolean;
  clonedFromTripId?: string;
  createdAt: Date;
  updatedAt: Date;
  // Optional included relations
  items?: TripItemResponse[];
  packingItems?: TripPackingItemResponse[];
  itineraries?: TripItineraryResponse[];
  reminders?: TripReminderResponse[];
  documents?: TripDocumentResponse[];
  contacts?: TripContactResponse[];
  locations?: TripLocationResponse[];
}

export interface TripItemResponse {
  id: string;
  tripId: string;
  type: TripItemType;
  name: string;
  description?: string;
  date?: Date;
  timeStart?: string;
  timeEnd?: string;
  durationHours?: number;
  location?: string;
  locationId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: TripItemStatus;
  priority: TripItemPriority;
  costEstimate?: number;
  costActual?: number;
  costIsPerPerson: boolean;
  currency: string;
  bookingUrl?: string;
  bookingReference?: string;
  confirmationNumber?: string;
  bookingDeadline?: Date;
  cancellationPolicy?: string;
  isCancellable: boolean;
  cancellationDeadline?: Date;
  requiresId: boolean;
  ageRestrictions?: string;
  // Transport-specific
  departureLocationId?: string;
  arrivalLocationId?: string;
  departureTime?: string;
  arrivalTime?: string;
  connectionToItemId?: string;
  seatNumbers?: string;
  terminal?: string;
  gate?: string;
  // Meal-specific
  partySize?: number;
  dietaryRequirements?: string[];
  specialRequests?: string;
  // Integration
  budgetCategoryId?: string;
  expenseId?: string;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Optional included relations
  options?: TripItemOptionResponse[];
  structuredLocation?: TripLocationResponse;
  departureLocation?: TripLocationResponse;
  arrivalLocation?: TripLocationResponse;
}

export interface TripItemOptionResponse {
  id: string;
  tripItemId: string;
  name: string;
  description?: string;
  costEstimate?: number;
  costIsPerPerson: boolean;
  currency: string;
  pros?: string[];
  cons?: string[];
  url?: string;
  status: TripItemStatus;
  rejectionReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TripPackingItemResponse {
  id: string;
  tripId: string;
  category: PackingCategory;
  item: string;
  quantity: number;
  status: PackingStatus;
  priority: PackingPriority;
  purchaseUrl?: string;
  purchasePrice?: number;
  currency: string;
  purchaseDeadline?: Date;
  wishlistItemId?: string;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TripItineraryResponse {
  id: string;
  tripId: string;
  version: number;
  name: string;
  status: ItineraryStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Optional included relations
  days?: TripItineraryDayResponse[];
}

export interface TripItineraryDayResponse {
  id: string;
  itineraryId: string;
  date: Date;
  dayNumber: number;
  theme?: string;
  pace: DayPace;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Optional included relations
  slots?: TripItinerarySlotResponse[];
}

export interface TripItinerarySlotResponse {
  id: string;
  itineraryDayId: string;
  tripItemId?: string;
  timeSlot: TimeSlot;
  timeStart?: string;
  timeEnd?: string;
  description?: string;
  travelTimeMinutes?: number;
  backupTripItemId?: string;
  estimatedCost?: number;
  weatherDependent: boolean;
  requiresBooking: boolean;
  notes?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  // Optional included relations
  tripItem?: TripItemResponse;
  backupTripItem?: TripItemResponse;
}

export interface TripReminderResponse {
  id: string;
  tripId: string;
  tripItemId?: string;
  title: string;
  description?: string;
  remindDate: Date;
  status: ReminderStatus;
  priority: TripItemPriority;
  taskType?: string;
  checklistItems?: ChecklistItem[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TripDocumentResponse {
  id: string;
  tripId: string;
  tripItemId?: string;
  travellerName?: string;
  type: DocumentType;
  title: string;
  fileUrl?: string;
  documentNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TripContactResponse {
  id: string;
  tripId: string;
  tripItemId?: string;
  type: ContactType;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isEmergency: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TripLocationResponse {
  id: string;
  tripId: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  type: LocationType;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Summary/aggregate response types
export interface TripStatusSummary {
  totalItems: number;
  byStatus: Record<TripItemStatus, number>;
  byType: Record<TripItemType, number>;
  budgetEstimated: number;
  budgetBooked: number;
  budgetActual: number;
  upcomingDeadlines: Array<{
    itemId: string;
    itemName: string;
    deadline: Date;
    type: 'booking' | 'cancellation';
  }>;
  pendingReminders: TripReminderResponse[];
  packingStatus: Record<PackingStatus, number>;
}

export interface TripTimelineItem {
  date: Date;
  type: 'deadline' | 'reminder' | 'trip_start' | 'trip_end' | 'item';
  title: string;
  description?: string;
  relatedId?: string;
  isPast: boolean;
}

export interface TripBudgetSummary {
  budgetTotal?: number;
  currency: string;
  estimated: {
    total: number;
    byType: Record<TripItemType, number>;
    byStatus: Record<TripItemStatus, number>;
    byCurrency: Record<string, number>;
  };
  actual: {
    total: number;
    byType: Record<TripItemType, number>;
  };
  remaining: number;
  packingToBuy: number;
}

// Packing list grouped by category
export interface PackingListGrouped {
  [category: string]: TripPackingItemResponse[];
}
