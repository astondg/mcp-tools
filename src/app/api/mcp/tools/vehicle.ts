import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicles,
  createServiceRecord,
  getServiceHistory,
  updateServiceRecord,
  deleteServiceRecord,
  createPart,
  getParts,
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  deleteMaintenanceSchedule,
  getMaintenanceSchedules,
  getUpcomingMaintenance,
} from '@/lib/vehicle/queries';
import { SERVICE_TYPES } from '@/lib/vehicle/types';

export function registerVehicleTools(server: McpServer): void {
  // Vehicle management (add, update, delete)
  server.tool(
    'vehicle_manage',
    'Add, update, or delete a vehicle for maintenance tracking',
    {
      action: z.enum(['add', 'update', 'delete']).describe('Action to perform'),
      // For add
      name: z.string().min(1).max(100).optional().describe('Display name (e.g., "Family SUV")'),
      make: z.string().min(1).max(50).optional().describe('Manufacturer (e.g., "Toyota")'),
      model: z.string().min(1).max(50).optional().describe('Model name (e.g., "RAV4")'),
      year: z.number().int().min(1900).max(2100).optional().describe('Model year'),
      vin: z.string().max(17).optional().describe('Vehicle Identification Number'),
      licensePlate: z.string().max(20).optional().describe('Registration plate'),
      currentOdometer: z.number().int().min(0).optional().describe('Current odometer reading in km'),
      notes: z.string().optional().describe('Additional notes'),
      // For update/delete
      vehicleId: z.string().uuid().optional().describe('Vehicle ID (required for update/delete)'),
      // For delete
      confirm: z.boolean().optional().describe('Must be true to confirm deletion'),
    },
    async (params) => {
      try {
        const { action, vehicleId, confirm, name, make, model, ...rest } = params;

        if (action === 'add') {
          if (!name || !make || !model) {
            return {
              content: [{ type: 'text', text: '❌ Name, make, and model are required to add a vehicle.' }]
            };
          }
          const vehicle = await createVehicle({ name, make, model, ...rest });
          return {
            content: [{
              type: 'text',
              text: `✅ Vehicle added successfully!\n\n` +
                    `• ID: ${vehicle.id}\n` +
                    `• Name: ${vehicle.name}\n` +
                    `• Vehicle: ${vehicle.year || ''} ${vehicle.make} ${vehicle.model}\n` +
                    `• Odometer: ${vehicle.currentOdometer.toLocaleString()} km\n` +
                    (vehicle.vin ? `• VIN: ${vehicle.vin}\n` : '') +
                    (vehicle.licensePlate ? `• Plate: ${vehicle.licensePlate}\n` : '')
            }]
          };
        }

        if (action === 'update') {
          if (!vehicleId) {
            return {
              content: [{ type: 'text', text: '❌ vehicleId is required for update action.' }]
            };
          }
          const updateData: Record<string, unknown> = {};
          if (name !== undefined) updateData.name = name;
          if (make !== undefined) updateData.make = make;
          if (model !== undefined) updateData.model = model;
          Object.entries(rest).forEach(([k, v]) => {
            if (v !== undefined) updateData[k] = v;
          });

          const vehicle = await updateVehicle(vehicleId, updateData);
          return {
            content: [{
              type: 'text',
              text: `✅ Vehicle updated!\n\n` +
                    `• Name: ${vehicle.name}\n` +
                    `• Vehicle: ${vehicle.year || ''} ${vehicle.make} ${vehicle.model}\n` +
                    `• Odometer: ${vehicle.currentOdometer.toLocaleString()} km`
            }]
          };
        }

        if (action === 'delete') {
          if (!vehicleId) {
            return {
              content: [{ type: 'text', text: '❌ vehicleId is required for delete action.' }]
            };
          }
          if (!confirm) {
            return {
              content: [{ type: 'text', text: '⚠️ Set confirm: true to delete this vehicle and all its records.' }]
            };
          }
          await deleteVehicle(vehicleId);
          return {
            content: [{ type: 'text', text: `✅ Vehicle and all associated records deleted.` }]
          };
        }

        return {
          content: [{ type: 'text', text: '❌ Invalid action. Use add, update, or delete.' }]
        };
      } catch (error) {
        console.error('Error in vehicle_manage:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // List all vehicles
  server.tool(
    'vehicle_list',
    'List all tracked vehicles with their current odometer readings',
    {},
    async () => {
      try {
        const vehicles = await getVehicles();

        if (vehicles.length === 0) {
          return {
            content: [{ type: 'text', text: 'No vehicles found. Use vehicle_manage with action: "add" to add one.' }]
          };
        }

        const vehicleList = vehicles.map(v =>
          `• **${v.name}** (ID: ${v.id})\n` +
          `  ${v.year || ''} ${v.make} ${v.model}\n` +
          `  Odometer: ${v.currentOdometer.toLocaleString()} km` +
          (v.licensePlate ? `\n  Plate: ${v.licensePlate}` : '')
        ).join('\n\n');

        return {
          content: [{ type: 'text', text: `🚗 Your Vehicles (${vehicles.length}):\n\n${vehicleList}` }]
        };
      } catch (error) {
        console.error('Error in vehicle_list:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Add service record
  server.tool(
    'vehicle_add_service',
    'Log a service performed on a vehicle, optionally including parts used',
    {
      vehicleId: z.string().uuid().describe('Vehicle ID'),
      serviceDate: z.string().describe('Service date (YYYY-MM-DD)'),
      serviceType: z.string().describe(`Service type (e.g., ${SERVICE_TYPES.slice(0, 5).join(', ')})`),
      odometer: z.number().int().min(0).optional().describe('Odometer reading at service (km)'),
      cost: z.number().min(0).optional().describe('Amount actually paid for service'),
      serviceTotalValue: z.coerce.number().min(0).optional().describe('Total value of service before any discounts or service plan coverage'),
      provider: z.string().max(100).optional().describe('Service provider name'),
      notes: z.string().optional().describe('Service notes'),
      parts: z.array(z.object({
        partId: z.string().uuid().optional().describe('Existing part ID'),
        name: z.string().optional().describe('Part name (creates new part)'),
        manufacturer: z.string().optional().describe('Part manufacturer'),
        partNumber: z.string().optional().describe('Part number'),
        quantity: z.number().int().min(1).optional().describe('Quantity used'),
        costPerUnit: z.number().min(0).optional().describe('Cost per unit'),
      })).optional().describe('Parts used in this service'),
      updateSchedule: z.boolean().optional().describe('Auto-update matching maintenance schedule (default: true)'),
    },
    async (params) => {
      try {
        const serviceDate = new Date(params.serviceDate);
        if (isNaN(serviceDate.getTime())) {
          return {
            content: [{ type: 'text', text: '❌ Invalid date format. Use YYYY-MM-DD.' }]
          };
        }

        const record = await createServiceRecord({
          vehicleId: params.vehicleId,
          serviceDate,
          serviceType: params.serviceType,
          odometer: params.odometer,
          cost: params.cost,
          serviceTotalValue: params.serviceTotalValue,
          provider: params.provider,
          notes: params.notes,
          parts: params.parts,
          updateSchedule: params.updateSchedule,
        });

        let response = `✅ Service recorded!\n\n` +
          `• Vehicle: ${record.vehicleName}\n` +
          `• Date: ${record.serviceDate.toISOString().split('T')[0]}\n` +
          `• Type: ${record.serviceType}\n` +
          (record.odometer ? `• Odometer: ${record.odometer.toLocaleString()} km\n` : '') +
          (record.cost !== null ? `• Cost paid: $${record.cost.toFixed(2)}\n` : '') +
          (record.serviceTotalValue !== null ? `• Service value: $${record.serviceTotalValue.toFixed(2)}\n` : '') +
          (record.serviceTotalValue !== null && record.cost !== null && record.serviceTotalValue > record.cost
            ? `• Savings: $${(record.serviceTotalValue - record.cost).toFixed(2)}\n` : '') +
          (record.provider ? `• Provider: ${record.provider}\n` : '');

        if (record.parts && record.parts.length > 0) {
          response += `\n📦 Parts Used:\n`;
          record.parts.forEach(p => {
            response += `  • ${p.quantity}x ${p.partName}`;
            if (p.partNumber) response += ` (${p.partNumber})`;
            if (p.costPerUnit) response += ` - $${p.costPerUnit.toFixed(2)} each`;
            response += '\n';
          });
        }

        return { content: [{ type: 'text', text: response }] };
      } catch (error) {
        console.error('Error in vehicle_add_service:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get service history
  server.tool(
    'vehicle_get_services',
    'Get service history for vehicles, with optional filters and text search. Use searchTerm to find services by provider, notes, or service type. Use providerSearch to find services at a specific shop (e.g., "costco", "repco").',
    {
      vehicleId: z.string().uuid().optional().describe('Filter by vehicle ID'),
      serviceType: z.string().optional().describe('Filter by service type'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      includeParts: z.boolean().optional().describe('Include parts details (default: true)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
      // New search parameters
      searchTerm: z.string().optional().describe('Search in provider, notes, and service type (case-insensitive)'),
      providerSearch: z.string().optional().describe('Search specifically for services at a provider/shop (case-insensitive)'),
      notesSearch: z.string().optional().describe('Search specifically in service notes (case-insensitive)'),
      partNameSearch: z.string().optional().describe('Search for services that used a specific part (searches part name, number, manufacturer)'),
    },
    async (params) => {
      try {
        const records = await getServiceHistory({
          vehicleId: params.vehicleId,
          serviceType: params.serviceType,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          includeParts: params.includeParts,
          limit: params.limit,
          searchTerm: params.searchTerm,
          providerSearch: params.providerSearch,
          notesSearch: params.notesSearch,
          partNameSearch: params.partNameSearch,
        });

        if (records.length === 0) {
          return {
            content: [{ type: 'text', text: 'No service records found matching your criteria.' }]
          };
        }

        const recordList = records.map(r => {
          let entry = `• **${r.serviceType}** on ${r.serviceDate.toISOString().split('T')[0]}\n` +
            `  ID: ${r.id}\n` +
            `  Vehicle: ${r.vehicleName}\n` +
            (r.odometer ? `  Odometer: ${r.odometer.toLocaleString()} km\n` : '') +
            (r.cost !== null ? `  Cost paid: $${r.cost.toFixed(2)}\n` : '') +
            (r.serviceTotalValue !== null ? `  Service value: $${r.serviceTotalValue.toFixed(2)}\n` : '') +
            (r.serviceTotalValue !== null && r.cost !== null && r.serviceTotalValue > r.cost
              ? `  Savings: $${(r.serviceTotalValue - r.cost).toFixed(2)}\n` : '') +
            (r.provider ? `  Provider: ${r.provider}\n` : '');

          if (r.parts && r.parts.length > 0) {
            entry += `  Parts: ${r.parts.map(p => p.partName).join(', ')}\n`;
          }
          return entry;
        }).join('\n');

        return {
          content: [{ type: 'text', text: `📋 Service History (${records.length} records):\n\n${recordList}` }]
        };
      } catch (error) {
        console.error('Error in vehicle_get_services:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Manage service record (update/delete)
  server.tool(
    'vehicle_manage_service',
    'Update or delete a service record',
    {
      action: z.enum(['update', 'delete']).describe('Action to perform'),
      serviceId: z.string().uuid().describe('Service record ID'),
      serviceDate: z.string().optional().describe('New service date (YYYY-MM-DD)'),
      serviceType: z.string().optional().describe('New service type'),
      odometer: z.number().int().min(0).optional().describe('New odometer reading'),
      cost: z.number().min(0).optional().describe('New amount paid'),
      serviceTotalValue: z.coerce.number().min(0).optional().describe('New service total value'),
      provider: z.string().optional().describe('New provider'),
      notes: z.string().optional().describe('New notes'),
    },
    async (params) => {
      try {
        if (params.action === 'delete') {
          await deleteServiceRecord(params.serviceId);
          return {
            content: [{ type: 'text', text: '✅ Service record deleted.' }]
          };
        }

        const updateData: Record<string, unknown> = {};
        if (params.serviceDate) updateData.serviceDate = new Date(params.serviceDate);
        if (params.serviceType) updateData.serviceType = params.serviceType;
        if (params.odometer !== undefined) updateData.odometer = params.odometer;
        if (params.cost !== undefined) updateData.cost = params.cost;
        if (params.serviceTotalValue !== undefined) updateData.serviceTotalValue = params.serviceTotalValue;
        if (params.provider !== undefined) updateData.provider = params.provider;
        if (params.notes !== undefined) updateData.notes = params.notes;

        const record = await updateServiceRecord(params.serviceId, updateData);
        return {
          content: [{
            type: 'text',
            text: `✅ Service record updated!\n\n` +
                  `• Type: ${record.serviceType}\n` +
                  `• Date: ${record.serviceDate.toISOString().split('T')[0]}\n` +
                  (record.cost ? `• Cost: $${record.cost.toFixed(2)}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in vehicle_manage_service:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Add a part
  server.tool(
    'vehicle_add_part',
    'Register a part in the database for reuse across services',
    {
      name: z.string().min(1).max(100).describe('Part name (e.g., "Spark Plug")'),
      manufacturer: z.string().max(50).optional().describe('Brand (e.g., "NGK")'),
      model: z.string().max(100).optional().describe('Model name'),
      partNumber: z.string().max(50).optional().describe('Part number (e.g., "94201")'),
      description: z.string().optional().describe('Description'),
      cost: z.number().min(0).optional().describe('Unit cost'),
      url: z.string().url().optional().describe('Purchase link'),
    },
    async (params) => {
      try {
        const part = await createPart(params);
        return {
          content: [{
            type: 'text',
            text: `✅ Part registered!\n\n` +
                  `• ID: ${part.id}\n` +
                  `• Name: ${part.name}\n` +
                  (part.manufacturer ? `• Manufacturer: ${part.manufacturer}\n` : '') +
                  (part.partNumber ? `• Part #: ${part.partNumber}\n` : '') +
                  (part.cost ? `• Cost: $${part.cost.toFixed(2)}\n` : '') +
                  (part.url ? `• URL: ${part.url}\n` : '')
          }]
        };
      } catch (error) {
        console.error('Error in vehicle_add_part:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get parts
  server.tool(
    'vehicle_get_parts',
    'List or search registered parts',
    {
      search: z.string().optional().describe('Search by name, manufacturer, or part number'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
    },
    async (params) => {
      try {
        const parts = await getParts(params);

        if (parts.length === 0) {
          return {
            content: [{ type: 'text', text: params.search
              ? `No parts found matching "${params.search}".`
              : 'No parts registered. Use vehicle_add_part to add one.' }]
          };
        }

        const partList = parts.map(p =>
          `• **${p.name}** (ID: ${p.id})\n` +
          (p.manufacturer ? `  Manufacturer: ${p.manufacturer}\n` : '') +
          (p.partNumber ? `  Part #: ${p.partNumber}\n` : '') +
          (p.cost ? `  Cost: $${p.cost.toFixed(2)}\n` : '')
        ).join('\n');

        return {
          content: [{ type: 'text', text: `🔧 Parts (${parts.length}):\n\n${partList}` }]
        };
      } catch (error) {
        console.error('Error in vehicle_get_parts:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Set maintenance schedule
  server.tool(
    'vehicle_set_schedule',
    'Create, update, or delete a maintenance schedule',
    {
      action: z.enum(['create', 'update', 'delete']).describe('Action to perform'),
      // For create
      vehicleId: z.string().uuid().optional().describe('Vehicle ID (required for create)'),
      name: z.string().max(100).optional().describe('Schedule name (e.g., "Oil Change")'),
      serviceType: z.string().optional().describe('Service type that this schedule tracks'),
      intervalKm: z.number().int().min(1).optional().describe('Interval in kilometers'),
      intervalMonths: z.number().int().min(1).optional().describe('Interval in months'),
      lastPerformedDate: z.string().optional().describe('Last service date (YYYY-MM-DD)'),
      lastPerformedOdometer: z.number().int().min(0).optional().describe('Odometer at last service'),
      notes: z.string().optional().describe('Notes'),
      // For update/delete
      scheduleId: z.string().uuid().optional().describe('Schedule ID (required for update/delete)'),
      enabled: z.boolean().optional().describe('Enable or disable the schedule'),
    },
    async (params) => {
      try {
        if (params.action === 'create') {
          if (!params.vehicleId || !params.name || !params.serviceType) {
            return {
              content: [{ type: 'text', text: '❌ vehicleId, name, and serviceType are required for create.' }]
            };
          }
          if (!params.intervalKm && !params.intervalMonths) {
            return {
              content: [{ type: 'text', text: '❌ At least one of intervalKm or intervalMonths is required.' }]
            };
          }

          const schedule = await createMaintenanceSchedule({
            vehicleId: params.vehicleId,
            name: params.name,
            serviceType: params.serviceType,
            intervalKm: params.intervalKm,
            intervalMonths: params.intervalMonths,
            lastPerformedDate: params.lastPerformedDate ? new Date(params.lastPerformedDate) : undefined,
            lastPerformedOdometer: params.lastPerformedOdometer,
            notes: params.notes,
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Maintenance schedule created!\n\n` +
                    `• ID: ${schedule.id}\n` +
                    `• Name: ${schedule.name}\n` +
                    `• Service Type: ${schedule.serviceType}\n` +
                    (schedule.intervalKm ? `• Every: ${schedule.intervalKm.toLocaleString()} km\n` : '') +
                    (schedule.intervalMonths ? `• Every: ${schedule.intervalMonths} months\n` : '')
            }]
          };
        }

        if (params.action === 'delete') {
          if (!params.scheduleId) {
            return {
              content: [{ type: 'text', text: '❌ scheduleId is required for delete.' }]
            };
          }
          await deleteMaintenanceSchedule(params.scheduleId);
          return {
            content: [{ type: 'text', text: '✅ Maintenance schedule deleted.' }]
          };
        }

        if (params.action === 'update') {
          if (!params.scheduleId) {
            return {
              content: [{ type: 'text', text: '❌ scheduleId is required for update.' }]
            };
          }
          const updateData: Record<string, unknown> = {};
          if (params.name) updateData.name = params.name;
          if (params.serviceType) updateData.serviceType = params.serviceType;
          if (params.intervalKm !== undefined) updateData.intervalKm = params.intervalKm;
          if (params.intervalMonths !== undefined) updateData.intervalMonths = params.intervalMonths;
          if (params.lastPerformedDate) updateData.lastPerformedDate = new Date(params.lastPerformedDate);
          if (params.lastPerformedOdometer !== undefined) updateData.lastPerformedOdometer = params.lastPerformedOdometer;
          if (params.enabled !== undefined) updateData.enabled = params.enabled;
          if (params.notes !== undefined) updateData.notes = params.notes;

          const schedule = await updateMaintenanceSchedule(params.scheduleId, updateData);
          return {
            content: [{
              type: 'text',
              text: `✅ Schedule updated!\n\n` +
                    `• Name: ${schedule.name}\n` +
                    `• Enabled: ${schedule.enabled ? 'Yes' : 'No'}`
            }]
          };
        }

        return {
          content: [{ type: 'text', text: '❌ Invalid action.' }]
        };
      } catch (error) {
        console.error('Error in vehicle_set_schedule:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get maintenance schedules
  server.tool(
    'vehicle_get_schedules',
    'List maintenance schedules for a vehicle',
    {
      vehicleId: z.string().uuid().describe('Vehicle ID'),
      enabledOnly: z.boolean().optional().describe('Only show enabled schedules (default: true)'),
    },
    async (params) => {
      try {
        const schedules = await getMaintenanceSchedules(params);

        if (schedules.length === 0) {
          return {
            content: [{ type: 'text', text: 'No maintenance schedules found for this vehicle.' }]
          };
        }

        const scheduleList = schedules.map(s => {
          let entry = `• **${s.name}** (${s.serviceType})\n` +
            `  ID: ${s.id}\n`;
          if (s.intervalKm) entry += `  Every: ${s.intervalKm.toLocaleString()} km\n`;
          if (s.intervalMonths) entry += `  Every: ${s.intervalMonths} months\n`;
          if (s.lastPerformedDate) {
            entry += `  Last: ${s.lastPerformedDate.toISOString().split('T')[0]}`;
            if (s.lastPerformedOdometer) entry += ` @ ${s.lastPerformedOdometer.toLocaleString()} km`;
            entry += '\n';
          }
          entry += `  Status: ${s.enabled ? '✅ Active' : '⏸️ Disabled'}`;
          return entry;
        }).join('\n\n');

        return {
          content: [{ type: 'text', text: `📅 Maintenance Schedules:\n\n${scheduleList}` }]
        };
      } catch (error) {
        console.error('Error in vehicle_get_schedules:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get upcoming maintenance
  server.tool(
    'vehicle_get_upcoming',
    'Get overdue and upcoming maintenance items',
    {
      vehicleId: z.string().uuid().optional().describe('Filter by vehicle (default: all vehicles)'),
      withinKm: z.number().int().min(0).optional().describe('Show items due within X km (default: 1000)'),
      withinMonths: z.number().int().min(0).optional().describe('Show items due within X months (default: 1)'),
    },
    async (params) => {
      try {
        const items = await getUpcomingMaintenance(params);

        if (items.length === 0) {
          return {
            content: [{ type: 'text', text: '✅ No maintenance is currently due or upcoming!' }]
          };
        }

        const overdueItems = items.filter(i => i.status === 'overdue');
        const dueSoonItems = items.filter(i => i.status === 'due_soon');

        let response = '';

        if (overdueItems.length > 0) {
          response += `🚨 **OVERDUE** (${overdueItems.length}):\n\n`;
          overdueItems.forEach(item => {
            response += `• **${item.name}** - ${item.vehicleName}\n`;
            if (item.kmOverdue) response += `  ⚠️ ${item.kmOverdue.toLocaleString()} km overdue\n`;
            if (item.daysOverdue) response += `  ⚠️ ${item.daysOverdue} days overdue\n`;
            response += '\n';
          });
        }

        if (dueSoonItems.length > 0) {
          response += `⏰ **DUE SOON** (${dueSoonItems.length}):\n\n`;
          dueSoonItems.forEach(item => {
            response += `• **${item.name}** - ${item.vehicleName}\n`;
            if (item.kmUntilDue) response += `  📏 Due in ${item.kmUntilDue.toLocaleString()} km\n`;
            if (item.daysUntilDue) response += `  📅 Due in ${item.daysUntilDue} days\n`;
            response += '\n';
          });
        }

        return {
          content: [{ type: 'text', text: response.trim() }]
        };
      } catch (error) {
        console.error('Error in vehicle_get_upcoming:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );
}
