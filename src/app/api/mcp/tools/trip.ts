import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createTrip,
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip,
  addTripItem,
  listTripItems,
  updateTripItem,
  deleteTripItem,
  addTripItemOption,
  selectTripItemOption,
  getTripStatus,
  getTripBudgetSummary,
  addPackingItem,
  listPackingItems,
  updatePackingItem,
  deletePackingItem,
  bulkUpdatePackingStatus,
  createItinerary,
  listItineraries,
  getItinerary,
  updateItinerary,
  generateItineraryDays,
  updateItineraryDay,
  addItinerarySlot,
  updateItinerarySlot,
  deleteItinerarySlot,
  autoPopulateItinerary,
  addReminder,
  listReminders,
  updateReminder,
  getDueReminders,
  addDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  addContact,
  listContacts,
  updateContact,
  deleteContact,
  addLocation,
  listLocations,
  getNearbyLocations,
  addNote,
  listNotes,
  updateNote,
  deleteNote,
} from '@/lib/trip/queries';
import {
  TripStatus,
  TripItemType,
  TripItemStatus,
  TripItemPriority,
  PackingStatus,
  ReminderStatus,
  DocumentType,
  ContactType,
  LocationType,
} from '@prisma/client';

export function registerTripTools(server: McpServer) {
  // ==========================================
  // Trip Management Tools
  // ==========================================

  // Create trip
  server.tool(
    'trip_create',
    'Create a new trip',
    {
      name: z.string().min(1).max(100).describe('Trip name (e.g., "London Christmas 2026")'),
      destination: z
        .string()
        .min(1)
        .max(200)
        .describe('Destination (e.g., "London, UK")'),
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      budgetTotal: z.number().min(0).optional().describe('Total budget'),
      currency: z.string().length(3).optional().describe('Currency code (default: AUD)'),
      travellers: z
        .array(
          z.object({
            name: z.string(),
            age: z.number().optional(),
            birthday: z.string().optional(),
            notes: z.string().optional(),
          })
        )
        .optional()
        .describe('Array of travellers'),
      expectedWeather: z
        .object({
          tempLow: z.number(),
          tempHigh: z.number(),
          conditions: z.string(),
          notes: z.string().optional(),
        })
        .optional()
        .describe('Expected weather conditions'),
      seasonalNotes: z.string().optional().describe('Seasonal information and notes'),
      timeZone: z.string().optional().describe('Destination time zone (e.g., "Europe/London")'),
      notes: z.string().optional().describe('General trip notes'),
    },
    async (params) => {
      try {
        const trip = await createTrip({
          name: params.name,
          destination: params.destination,
          startDate: new Date(params.startDate),
          endDate: new Date(params.endDate),
          budgetTotal: params.budgetTotal,
          currency: params.currency,
          travellers: params.travellers,
          expectedWeather: params.expectedWeather,
          seasonalNotes: params.seasonalNotes,
          timeZone: params.timeZone,
          notes: params.notes,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(trip, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error creating trip: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List trips
  server.tool(
    'trip_list',
    'List all trips with optional filters',
    {
      status: z.nativeEnum(TripStatus).optional().describe('Filter by trip status'),
      includeCompleted: z.boolean().optional().describe('Include completed trips (default: false)'),
      limit: z.number().int().positive().optional().describe('Maximum number of trips to return'),
    },
    async (params) => {
      try {
        const trips = await listTrips({
          status: params.status,
          includeCompleted: params.includeCompleted,
          limit: params.limit,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(trips, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing trips: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Get trip
  server.tool(
    'trip_get',
    'Get trip details with full breakdown',
    {
      tripId: z.string().uuid().describe('Trip ID'),
      includeItems: z.boolean().optional().describe('Include trip items (default: true)'),
      includePackingItems: z.boolean().optional().describe('Include packing list (default: false)'),
      includeItineraries: z.boolean().optional().describe('Include itineraries (default: false)'),
      includeReminders: z.boolean().optional().describe('Include reminders (default: true)'),
      includeDocuments: z.boolean().optional().describe('Include documents (default: false)'),
      includeContacts: z.boolean().optional().describe('Include contacts (default: false)'),
    },
    async (params) => {
      try {
        const trip = await getTrip(params.tripId, {
          includeItems: params.includeItems ?? true,
          includePackingItems: params.includePackingItems,
          includeItineraries: params.includeItineraries,
          includeReminders: params.includeReminders ?? true,
          includeDocuments: params.includeDocuments,
          includeContacts: params.includeContacts,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(trip, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting trip: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Update trip
  server.tool(
    'trip_update',
    'Update trip details',
    {
      tripId: z.string().uuid().describe('Trip ID'),
      name: z.string().min(1).max(100).optional().describe('Trip name'),
      destination: z.string().min(1).max(200).optional().describe('Destination'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      status: z.nativeEnum(TripStatus).optional().describe('Trip status'),
      budgetTotal: z.number().min(0).optional().describe('Total budget'),
      notes: z.string().optional().describe('Trip notes'),
    },
    async (params) => {
      try {
        const trip = await updateTrip(params.tripId, {
          name: params.name,
          destination: params.destination,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          status: params.status,
          budgetTotal: params.budgetTotal,
          notes: params.notes,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(trip, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating trip: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Delete trip
  server.tool(
    'trip_delete',
    'Delete a trip and all associated data',
    {
      tripId: z.string().uuid().describe('Trip ID'),
      confirm: z.boolean().describe('Confirm deletion (must be true)'),
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Deletion not confirmed. Set confirm=true to delete.',
              },
            ],
          };
        }
        const result = await deleteTrip(params.tripId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting trip: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Get trip status
  server.tool(
    'trip_get_status',
    'Get trip planning status summary with breakdowns by status, type, budget, and packing',
    {
      tripId: z.string().uuid().describe('Trip ID'),
    },
    async (params) => {
      try {
        const status = await getTripStatus(params.tripId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting trip status: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Get budget summary
  server.tool(
    'trip_budget_summary',
    'Get trip budget breakdown with estimated and actual costs by type, status, and currency',
    {
      tripId: z.string().uuid().describe('Trip ID'),
    },
    async (params) => {
      try {
        const summary = await getTripBudgetSummary(params.tripId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error getting budget summary: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Trip Item Tools
  // ==========================================

  // Add trip item
  server.tool(
    'trip_item_add',
    'Add an item to a trip (activity, flight, accommodation, meal, transport, etc.)',
    {
      tripId: z.string().uuid().describe('Trip ID'),
      type: z.nativeEnum(TripItemType).describe('Item type (FLIGHT, ACCOMMODATION, ACTIVITY, etc.)'),
      name: z.string().min(1).max(200).describe('Item name'),
      description: z.string().optional().describe('Detailed description'),
      date: z.string().optional().describe('Date (YYYY-MM-DD), null for unscheduled ideas'),
      timeStart: z.string().optional().describe('Start time (HH:MM)'),
      timeEnd: z.string().optional().describe('End time (HH:MM)'),
      durationHours: z.number().optional().describe('Duration in hours'),
      location: z.string().optional().describe('Location name'),
      address: z.string().optional().describe('Full address'),
      status: z.nativeEnum(TripItemStatus).optional().describe('Status (default: IDEA)'),
      priority: z.nativeEnum(TripItemPriority).optional().describe('Priority (default: MEDIUM)'),
      costEstimate: z.number().min(0).optional().describe('Estimated cost'),
      costIsPerPerson: z.boolean().optional().describe('Cost is per person (default: false)'),
      currency: z.string().length(3).optional().describe('Currency code (default: AUD)'),
      bookingUrl: z.string().optional().describe('Booking website URL'),
      bookingDeadline: z.string().optional().describe('Booking deadline date (YYYY-MM-DD)'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (params) => {
      try {
        const item = await addTripItem({
          tripId: params.tripId,
          type: params.type,
          name: params.name,
          description: params.description,
          date: params.date ? new Date(params.date) : undefined,
          timeStart: params.timeStart,
          timeEnd: params.timeEnd,
          durationHours: params.durationHours,
          location: params.location,
          address: params.address,
          status: params.status,
          priority: params.priority,
          costEstimate: params.costEstimate,
          costIsPerPerson: params.costIsPerPerson,
          currency: params.currency,
          bookingUrl: params.bookingUrl,
          bookingDeadline: params.bookingDeadline ? new Date(params.bookingDeadline) : undefined,
          tags: params.tags,
          notes: params.notes,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error adding trip item: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // List trip items
  server.tool(
    'trip_item_list',
    'List trip items with optional filters',
    {
      tripId: z.string().uuid().describe('Trip ID'),
      type: z.nativeEnum(TripItemType).optional().describe('Filter by item type'),
      status: z
        .union([z.nativeEnum(TripItemStatus), z.array(z.nativeEnum(TripItemStatus))])
        .optional()
        .describe('Filter by status (single or array)'),
      priority: z.nativeEnum(TripItemPriority).optional().describe('Filter by priority'),
      unscheduledOnly: z.boolean().optional().describe('Only show unscheduled ideas'),
    },
    async (params) => {
      try {
        const items = await listTripItems(params.tripId, {
          type: params.type,
          status: params.status,
          priority: params.priority,
          unscheduledOnly: params.unscheduledOnly,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing trip items: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Update trip item
  server.tool(
    'trip_item_update',
    'Update a trip item',
    {
      itemId: z.string().uuid().describe('Item ID'),
      name: z.string().min(1).max(200).optional().describe('Item name'),
      description: z.string().optional().describe('Description'),
      date: z.string().optional().describe('Date (YYYY-MM-DD)'),
      timeStart: z.string().optional().describe('Start time (HH:MM)'),
      timeEnd: z.string().optional().describe('End time (HH:MM)'),
      status: z.nativeEnum(TripItemStatus).optional().describe('Status'),
      priority: z.nativeEnum(TripItemPriority).optional().describe('Priority'),
      costEstimate: z.number().min(0).optional().describe('Estimated cost'),
      costActual: z.number().min(0).optional().describe('Actual cost paid'),
      bookingReference: z.string().optional().describe('Booking reference number'),
      confirmationNumber: z.string().optional().describe('Confirmation number'),
      notes: z.string().optional().describe('Notes'),
    },
    async (params) => {
      try {
        const item = await updateTripItem(params.itemId, {
          name: params.name,
          description: params.description,
          date: params.date ? new Date(params.date) : undefined,
          timeStart: params.timeStart,
          timeEnd: params.timeEnd,
          status: params.status,
          priority: params.priority,
          costEstimate: params.costEstimate,
          costActual: params.costActual,
          bookingReference: params.bookingReference,
          confirmationNumber: params.confirmationNumber,
          notes: params.notes,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating trip item: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Delete trip item
  server.tool(
    'trip_item_delete',
    'Delete a trip item',
    {
      itemId: z.string().uuid().describe('Item ID'),
    },
    async (params) => {
      try {
        const result = await deleteTripItem(params.itemId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting trip item: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Add trip item option
  server.tool(
    'trip_item_option_add',
    'Add an option to compare for a trip item (e.g., different hotel choices)',
    {
      tripItemId: z.string().uuid().describe('Trip item ID'),
      name: z.string().min(1).max(200).describe('Option name (e.g., hotel name)'),
      description: z.string().optional().describe('Description'),
      costEstimate: z.number().min(0).optional().describe('Estimated cost'),
      costIsPerPerson: z.boolean().optional().describe('Cost is per person'),
      currency: z.string().length(3).optional().describe('Currency code'),
      pros: z.array(z.string()).optional().describe('List of pros/advantages'),
      cons: z.array(z.string()).optional().describe('List of cons/disadvantages'),
      url: z.string().optional().describe('Website URL'),
      notes: z.string().optional().describe('Notes'),
    },
    async (params) => {
      try {
        const option = await addTripItemOption({
          tripItemId: params.tripItemId,
          name: params.name,
          description: params.description,
          costEstimate: params.costEstimate,
          costIsPerPerson: params.costIsPerPerson,
          currency: params.currency,
          pros: params.pros,
          cons: params.cons,
          url: params.url,
          notes: params.notes,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(option, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding trip item option: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Select trip item option
  server.tool(
    'trip_item_option_select',
    'Select an option as the winner (marks others as rejected)',
    {
      optionId: z.string().uuid().describe('Option ID to select'),
      rejectionReason: z.string().optional().describe('Reason for rejecting other options'),
    },
    async (params) => {
      try {
        const result = await selectTripItemOption(params.optionId, params.rejectionReason);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error selecting option: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Packing List Management Tools
  // ==========================================

  // Add packing item
  server.tool(
    'trip_packing_add',
    'Add item to packing list',
    {
      tripId: z.string().uuid(),
      name: z.string().min(1).max(200),
      category: z.string().max(50).optional().describe('e.g., "Clothing", "Electronics"'),
      quantity: z.number().int().min(1).optional(),
      status: z.nativeEnum(PackingStatus).optional(),
      purchasePrice: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      purchaseUrl: z.string().url().optional(),
      wishlistItemId: z.string().uuid().optional(),
      budgetCategoryId: z.string().uuid().optional(),
      assignedTo: z.string().max(100).optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const item = await addPackingItem(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding packing item: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List packing items
  server.tool(
    'trip_packing_list',
    'List packing items with filters',
    {
      tripId: z.string().uuid(),
      status: z.union([z.nativeEnum(PackingStatus), z.array(z.nativeEnum(PackingStatus))]).optional(),
      category: z.string().optional(),
      assignedTo: z.string().optional(),
    },
    async (params) => {
      try {
        const items = await listPackingItems(params.tripId, {
          status: params.status,
          category: params.category,
          assignedTo: params.assignedTo,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing packing items: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update packing item
  server.tool(
    'trip_packing_update',
    'Update a packing item',
    {
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      category: z.string().max(50).optional(),
      quantity: z.number().int().min(1).optional(),
      status: z.nativeEnum(PackingStatus).optional(),
      purchasePrice: z.number().min(0).optional(),
      purchaseUrl: z.string().url().optional(),
      assignedTo: z.string().max(100).optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const item = await updatePackingItem(params.id, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating packing item: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete packing item
  server.tool(
    'trip_packing_delete',
    'Delete a packing item',
    {
      id: z.string().uuid(),
    },
    async (params) => {
      try {
        const result = await deletePackingItem(params.id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error deleting packing item: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Bulk update packing status
  server.tool(
    'trip_packing_bulk_status',
    'Update status for multiple packing items at once',
    {
      tripId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()),
      status: z.nativeEnum(PackingStatus),
    },
    async (params) => {
      try {
        const result = await bulkUpdatePackingStatus(params.tripId, params.itemIds, params.status);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error bulk updating packing items: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Itinerary Management Tools
  // ==========================================

  // Create itinerary
  server.tool(
    'trip_itinerary_create',
    'Create a new itinerary for the trip',
    {
      tripId: z.string().uuid(),
      name: z.string().min(1).max(100).describe('e.g., "Main Itinerary", "Option B"'),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    },
    async (params) => {
      try {
        const itinerary = await createItinerary(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(itinerary, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error creating itinerary: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List itineraries
  server.tool(
    'trip_itinerary_list',
    'List all itineraries for a trip',
    {
      tripId: z.string().uuid(),
    },
    async (params) => {
      try {
        const itineraries = await listItineraries(params.tripId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(itineraries, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing itineraries: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Get itinerary with days and slots
  server.tool(
    'trip_itinerary_get',
    'Get full itinerary with all days and time slots',
    {
      id: z.string().uuid(),
    },
    async (params) => {
      try {
        const itinerary = await getItinerary(params.id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(itinerary, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error getting itinerary: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update itinerary
  server.tool(
    'trip_itinerary_update',
    'Update itinerary details',
    {
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    },
    async (params) => {
      try {
        const itinerary = await updateItinerary(params.id, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(itinerary, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating itinerary: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Generate days for itinerary
  server.tool(
    'trip_itinerary_generate_days',
    'Auto-generate day entries based on trip dates',
    {
      itineraryId: z.string().uuid(),
    },
    async (params) => {
      try {
        const result = await generateItineraryDays(params.itineraryId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error generating days: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update day
  server.tool(
    'trip_itinerary_day_update',
    'Update a day in the itinerary',
    {
      id: z.string().uuid(),
      title: z.string().max(200).optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const day = await updateItineraryDay(params.id, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(day, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating day: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Add slot to day
  server.tool(
    'trip_itinerary_slot_add',
    'Add a time slot to a day',
    {
      dayId: z.string().uuid(),
      tripItemId: z.string().uuid().optional(),
      startTime: z.string().optional().describe('HH:MM format'),
      endTime: z.string().optional().describe('HH:MM format'),
      title: z.string().max(200).optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      isTentative: z.boolean().optional(),
      backupTripItemId: z.string().uuid().optional(),
      transportNotes: z.string().optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const slot = await addItinerarySlot(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(slot, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding slot: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update slot
  server.tool(
    'trip_itinerary_slot_update',
    'Update a time slot',
    {
      id: z.string().uuid(),
      tripItemId: z.string().uuid().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      title: z.string().max(200).optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      isTentative: z.boolean().optional(),
      transportNotes: z.string().optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const slot = await updateItinerarySlot(params.id, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(slot, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating slot: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete slot
  server.tool(
    'trip_itinerary_slot_delete',
    'Delete a time slot',
    {
      id: z.string().uuid(),
    },
    async (params) => {
      try {
        const result = await deleteItinerarySlot(params.id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error deleting slot: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Auto-populate itinerary
  server.tool(
    'trip_itinerary_auto_populate',
    'Auto-populate itinerary from booked trip items',
    {
      itineraryId: z.string().uuid(),
    },
    async (params) => {
      try {
        const result = await autoPopulateItinerary(params.itineraryId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error auto-populating itinerary: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Reminder Management Tools
  // ==========================================

  // Add reminder
  server.tool(
    'trip_reminder_add',
    'Add a reminder or task',
    {
      tripId: z.string().uuid(),
      tripItemId: z.string().uuid().optional(),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      remindDate: z.string().describe('YYYY-MM-DD or YYYY-MM-DDTHH:MM'),
      priority: z.nativeEnum(TripItemPriority).optional(),
      taskType: z.string().optional(),
      checklistItems: z.array(z.object({ task: z.string(), completed: z.boolean() })).optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const reminder = await addReminder({
          ...params,
          remindDate: new Date(params.remindDate),
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(reminder, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding reminder: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List reminders
  server.tool(
    'trip_reminder_list',
    'List reminders with filters',
    {
      tripId: z.string().uuid(),
      status: z.union([z.nativeEnum(ReminderStatus), z.array(z.nativeEnum(ReminderStatus))]).optional(),
      priority: z.nativeEnum(TripItemPriority).optional(),
      taskType: z.string().optional(),
      tripItemId: z.string().uuid().optional(),
      overdueOnly: z.boolean().optional(),
    },
    async (params) => {
      try {
        const reminders = await listReminders(params.tripId, {
          status: params.status,
          priority: params.priority,
          taskType: params.taskType,
          tripItemId: params.tripItemId,
          overdueOnly: params.overdueOnly,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(reminders, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing reminders: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update reminder
  server.tool(
    'trip_reminder_update',
    'Update a reminder',
    {
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      remindDate: z.string().optional(),
      status: z.nativeEnum(ReminderStatus).optional(),
      priority: z.nativeEnum(TripItemPriority).optional(),
      checklistItems: z.array(z.object({ task: z.string(), completed: z.boolean() })).optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const reminder = await updateReminder(params.id, {
          ...params,
          remindDate: params.remindDate ? new Date(params.remindDate) : undefined,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(reminder, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating reminder: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Get due reminders
  server.tool(
    'trip_reminder_get_due',
    'Get upcoming or overdue reminders',
    {
      tripId: z.string().uuid(),
      daysAhead: z.number().int().min(0).max(365).optional().describe('Days to look ahead (default: 7)'),
    },
    async (params) => {
      try {
        const reminders = await getDueReminders(params.tripId, params.daysAhead);
        return { content: [{ type: 'text' as const, text: JSON.stringify(reminders, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error getting due reminders: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Document Management Tools
  // ==========================================

  // Add document
  server.tool(
    'trip_document_add',
    'Add a travel document (passport, visa, ticket, etc.)',
    {
      tripId: z.string().uuid(),
      type: z.nativeEnum(DocumentType),
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      documentNumber: z.string().max(100).optional(),
      expiryDate: z.string().optional().describe('YYYY-MM-DD'),
      issueDate: z.string().optional().describe('YYYY-MM-DD'),
      issuingAuthority: z.string().max(200).optional(),
      fileUrl: z.string().url().optional(),
      status: z.string().optional(),
      assignedTo: z.string().max(100).optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const document = await addDocument({
          ...params,
          expiryDate: params.expiryDate ? new Date(params.expiryDate) : undefined,
          issueDate: params.issueDate ? new Date(params.issueDate) : undefined,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(document, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding document: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List documents
  server.tool(
    'trip_document_list',
    'List travel documents with filters',
    {
      tripId: z.string().uuid(),
      type: z.union([z.nativeEnum(DocumentType), z.array(z.nativeEnum(DocumentType))]).optional(),
      status: z.string().optional(),
      assignedTo: z.string().optional(),
      expiringWithinDays: z.number().int().min(0).optional(),
    },
    async (params) => {
      try {
        const documents = await listDocuments(params.tripId, {
          type: params.type,
          status: params.status,
          assignedTo: params.assignedTo,
          expiringWithinDays: params.expiringWithinDays,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(documents, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing documents: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update document
  server.tool(
    'trip_document_update',
    'Update a travel document',
    {
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      documentNumber: z.string().max(100).optional(),
      expiryDate: z.string().optional(),
      issueDate: z.string().optional(),
      issuingAuthority: z.string().max(200).optional(),
      fileUrl: z.string().url().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      try {
        const document = await updateDocument(params.id, {
          ...params,
          expiryDate: params.expiryDate ? new Date(params.expiryDate) : undefined,
          issueDate: params.issueDate ? new Date(params.issueDate) : undefined,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(document, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating document: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete document
  server.tool(
    'trip_document_delete',
    'Delete a travel document',
    {
      id: z.string().uuid(),
    },
    async (params) => {
      try {
        const result = await deleteDocument(params.id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error deleting document: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Contact Management Tools
  // ==========================================

  // Add contact
  server.tool(
    'trip_contact_add',
    'Add a contact (hotel, embassy, emergency contact, etc.)',
    {
      tripId: z.string().uuid(),
      type: z.nativeEnum(ContactType),
      name: z.string().min(1).max(200),
      organization: z.string().max(200).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      website: z.string().url().optional(),
      emergencyContact: z.boolean().optional(),
      notes: z.string().optional(),
      customFields: z.record(z.string(), z.any()).optional(),
    },
    async (params) => {
      try {
        const contact = await addContact(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(contact, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding contact: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List contacts
  server.tool(
    'trip_contact_list',
    'List contacts with filters',
    {
      tripId: z.string().uuid(),
      type: z.union([z.nativeEnum(ContactType), z.array(z.nativeEnum(ContactType))]).optional(),
      emergencyOnly: z.boolean().optional(),
    },
    async (params) => {
      try {
        const contacts = await listContacts(params.tripId, {
          type: params.type,
          emergencyOnly: params.emergencyOnly,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(contacts, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing contacts: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update contact
  server.tool(
    'trip_contact_update',
    'Update a contact',
    {
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      organization: z.string().max(200).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      website: z.string().url().optional(),
      emergencyContact: z.boolean().optional(),
      notes: z.string().optional(),
      customFields: z.record(z.string(), z.any()).optional(),
    },
    async (params) => {
      try {
        const contact = await updateContact(params.id, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(contact, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating contact: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete contact
  server.tool(
    'trip_contact_delete',
    'Delete a contact',
    {
      id: z.string().uuid(),
    },
    async (params) => {
      try {
        const result = await deleteContact(params.id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error deleting contact: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Location Management Tools
  // ==========================================

  // Add location
  server.tool(
    'trip_location_add',
    'Add a saved location',
    {
      tripId: z.string().uuid(),
      type: z.nativeEnum(LocationType),
      name: z.string().min(1).max(200),
      address: z.string().optional(),
      city: z.string().max(100).optional(),
      country: z.string().max(100).optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      googleMapsUrl: z.string().url().optional(),
      website: z.string().url().optional(),
      phone: z.string().max(50).optional(),
      openingHours: z.string().optional(),
      notes: z.string().optional(),
      customFields: z.record(z.string(), z.any()).optional(),
    },
    async (params) => {
      try {
        const location = await addLocation(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(location, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding location: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List locations
  server.tool(
    'trip_location_list',
    'List saved locations with filters',
    {
      tripId: z.string().uuid(),
      type: z.union([z.nativeEnum(LocationType), z.array(z.nativeEnum(LocationType))]).optional(),
      city: z.string().optional(),
      country: z.string().optional(),
    },
    async (params) => {
      try {
        const locations = await listLocations(params.tripId, {
          type: params.type,
          city: params.city,
          country: params.country,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(locations, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing locations: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Get nearby locations
  server.tool(
    'trip_location_get_nearby',
    'Find saved locations near coordinates',
    {
      tripId: z.string().uuid(),
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().min(0).max(50).optional().describe('Radius in kilometers (default: 5)'),
    },
    async (params) => {
      try {
        const locations = await getNearbyLocations(
          params.tripId,
          params.latitude,
          params.longitude,
          params.radiusKm
        );
        return { content: [{ type: 'text' as const, text: JSON.stringify(locations, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error getting nearby locations: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Note Management Tools
  // ==========================================

  // Add note
  server.tool(
    'trip_note_add',
    'Add a note or journal entry',
    {
      tripId: z.string().uuid(),
      tripItemId: z.string().uuid().optional(),
      title: z.string().min(1).max(200),
      content: z.string().min(1),
      noteDate: z.string().optional().describe('YYYY-MM-DD (defaults to now)'),
      tags: z.array(z.string()).optional(),
      isPinned: z.boolean().optional(),
      attachments: z.array(z.object({
        name: z.string(),
        url: z.string().url(),
        type: z.string().optional(),
      })).optional(),
    },
    async (params) => {
      try {
        const note = await addNote({
          ...params,
          noteDate: params.noteDate ? new Date(params.noteDate) : undefined,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(note, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding note: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List notes
  server.tool(
    'trip_note_list',
    'List notes with filters',
    {
      tripId: z.string().uuid(),
      tripItemId: z.string().uuid().optional(),
      tag: z.string().optional(),
      pinnedOnly: z.boolean().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      searchTerm: z.string().optional(),
    },
    async (params) => {
      try {
        const notes = await listNotes(params.tripId, {
          tripItemId: params.tripItemId,
          tag: params.tag,
          pinnedOnly: params.pinnedOnly,
          dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
          dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
          searchTerm: params.searchTerm,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notes, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing notes: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update note
  server.tool(
    'trip_note_update',
    'Update a note',
    {
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().min(1).optional(),
      noteDate: z.string().optional(),
      tags: z.array(z.string()).optional(),
      isPinned: z.boolean().optional(),
      attachments: z.array(z.object({
        name: z.string(),
        url: z.string().url(),
        type: z.string().optional(),
      })).optional(),
    },
    async (params) => {
      try {
        const note = await updateNote(params.id, {
          ...params,
          noteDate: params.noteDate ? new Date(params.noteDate) : undefined,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(note, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating note: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete note
  server.tool(
    'trip_note_delete',
    'Delete a note',
    {
      id: z.string().uuid(),
    },
    async (params) => {
      try {
        const result = await deleteNote(params.id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error deleting note: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
