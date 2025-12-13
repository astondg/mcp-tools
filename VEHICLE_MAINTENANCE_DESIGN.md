# Vehicle Maintenance Tracking System - Design Document

## Research Summary

### Features Analysis from Popular Apps

Based on research of apps like **Fuelly**, **Drivvo**, and **Simply Auto**, the key features for vehicle maintenance tracking include:

| Feature Category | Must Have | Nice to Have |
|-----------------|-----------|--------------|
| **Service Records** | Date, type, cost, odometer, provider, notes | Receipt photos, documents |
| **Parts Tracking** | Name, manufacturer, part number, linked to services | Price tracking, URLs to purchase |
| **Maintenance Schedules** | Interval-based reminders (km/time) | Smart predictions |
| **Vehicle Info** | Make, model, year, current odometer | VIN, license plate, photos |
| **Reporting** | Service history, cost summaries | Charts, export to CSV |

### Storage Decision

**Current State:** Using Upstash Redis for OAuth token storage (simple key-value)

**Recommendation: Add Vercel Postgres (powered by Neon)**

| Option | Free Tier | Pros | Cons |
|--------|-----------|------|------|
| **Upstash Redis only** | 10K cmd/day | Already integrated | Poor for relational data, complex querying |
| **Vercel Postgres** | 256MB, 60 compute hrs | Seamless Vercel integration, Prisma support, serverless | Lower free tier than some |
| **Supabase** | 500MB, 50K MAU | Rich features (auth, realtime) | Auto-suspends after 7 days inactivity |
| **Turso** | 9GB storage | Generous tier, edge support | SQLite (less familiar tooling) |

**Decision: Vercel Postgres** for these reasons:
1. Seamless integration with existing Vercel deployment
2. Native Prisma ORM support (type-safe queries)
3. Serverless-friendly (matches MCP use pattern)
4. Will scale well for future budget/expense tracking
5. PostgreSQL is industry-standard for relational data

Keep Upstash Redis for caching/session data as needed.

---

## Data Model

### Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  vehicles   │       │  service_records │       │     parts       │
├─────────────┤       ├──────────────────┤       ├─────────────────┤
│ id (PK)     │──┐    │ id (PK)          │       │ id (PK)         │
│ name        │  │    │ vehicle_id (FK)  │──┐    │ name            │
│ make        │  └───<│ service_date     │  │    │ manufacturer    │
│ model       │       │ service_type     │  │    │ model           │
│ year        │       │ odometer         │  │    │ part_number     │
│ vin         │       │ cost             │  │    │ description     │
│ license     │       │ provider         │  │    │ cost            │
│ odometer    │       │ notes            │  │    │ url             │
│ created_at  │       │ created_at       │  │    │ created_at      │
└─────────────┘       └──────────────────┘  │    └─────────────────┘
                                            │            │
      ┌─────────────────────────┐           │            │
      │  maintenance_schedules  │           │    ┌───────┴───────┐
      ├─────────────────────────┤           │    │ service_parts │
      │ id (PK)                 │           │    ├───────────────┤
      │ vehicle_id (FK)         │───────────┘    │ id (PK)       │
      │ name                    │                │ service_id(FK)│──> service_records
      │ service_type            │                │ part_id (FK)  │──> parts
      │ interval_km             │                │ quantity      │
      │ interval_months         │                │ cost_per_unit │
      │ last_performed_date     │                │ notes         │
      │ last_performed_odometer │                └───────────────┘
      │ enabled                 │
      │ created_at              │
      └─────────────────────────┘
```

### Table Definitions

#### `vehicles`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| name | VARCHAR(100) | NOT NULL | Display name (e.g., "Family SUV") |
| make | VARCHAR(50) | NOT NULL | Manufacturer (e.g., "Toyota") |
| model | VARCHAR(50) | NOT NULL | Model name (e.g., "RAV4") |
| year | INTEGER | | Model year |
| vin | VARCHAR(17) | UNIQUE | Vehicle Identification Number |
| license_plate | VARCHAR(20) | | Registration plate |
| current_odometer | INTEGER | DEFAULT 0 | Current odometer reading (km) |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |

#### `service_records`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| vehicle_id | UUID | FK → vehicles(id), NOT NULL | Associated vehicle |
| service_date | DATE | NOT NULL | Date service was performed |
| service_type | VARCHAR(50) | NOT NULL | Type (oil_change, tire_rotation, etc.) |
| odometer | INTEGER | | Odometer at time of service (km) |
| cost | DECIMAL(10,2) | | Total cost of service |
| provider | VARCHAR(100) | | Service provider name |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |

#### `parts`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| name | VARCHAR(100) | NOT NULL | Part name (e.g., "Spark Plug") |
| manufacturer | VARCHAR(50) | | Brand (e.g., "NGK") |
| model | VARCHAR(100) | | Model name |
| part_number | VARCHAR(50) | | OEM/aftermarket part number |
| description | TEXT | | Detailed description |
| cost | DECIMAL(10,2) | | Unit cost |
| url | VARCHAR(500) | | Link to product page |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |

#### `service_parts` (Junction Table)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| service_record_id | UUID | FK → service_records(id), NOT NULL | Associated service |
| part_id | UUID | FK → parts(id), NOT NULL | Associated part |
| quantity | INTEGER | DEFAULT 1 | Number of parts used |
| cost_per_unit | DECIMAL(10,2) | | Cost at time of service |
| notes | TEXT | | Installation notes |

#### `maintenance_schedules`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| vehicle_id | UUID | FK → vehicles(id), NOT NULL | Associated vehicle |
| name | VARCHAR(100) | NOT NULL | Schedule name |
| service_type | VARCHAR(50) | NOT NULL | Matches service_records type |
| interval_km | INTEGER | | Interval in kilometers |
| interval_months | INTEGER | | Interval in months |
| last_performed_date | DATE | | Last time this service was done |
| last_performed_odometer | INTEGER | | Odometer at last service |
| enabled | BOOLEAN | DEFAULT TRUE | Whether schedule is active |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |

### Standard Service Types (Enum-like)
```typescript
const SERVICE_TYPES = [
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
  'other'
] as const;
```

---

## MCP Tools Design (Consolidated - 10 Tools)

> **Note:** Tools are consolidated to stay well under the 30-50 tool threshold where Claude's
> selection accuracy begins to degrade. All tools are prefixed with `vehicle_` for clear domain
> separation from future budget/expense tools.

### Tool Summary

| Tool | Purpose |
|------|---------|
| `vehicle_manage` | Add, update, or delete a vehicle |
| `vehicle_list` | List all tracked vehicles |
| `vehicle_add_service` | Log a service with optional parts |
| `vehicle_get_services` | Get service history with filters |
| `vehicle_manage_service` | Update or delete a service record |
| `vehicle_add_part` | Register a reusable part |
| `vehicle_get_parts` | Search/list registered parts |
| `vehicle_set_schedule` | Create, update, or delete maintenance schedule |
| `vehicle_get_schedules` | List maintenance schedules for a vehicle |
| `vehicle_get_upcoming` | Get overdue and upcoming maintenance |

---

### Vehicle Management

#### `vehicle_manage`
Add, update, or delete a vehicle.
```typescript
{
  action: 'add' | 'update' | 'delete',  // Required
  // For 'add':
  name: string,          // Required: Display name
  make: string,          // Required: Manufacturer
  model: string,         // Required: Model name
  year?: number,         // Optional: Model year
  vin?: string,          // Optional: VIN
  licensePlate?: string, // Optional: Registration
  currentOdometer?: number, // Optional: Starting odometer (km)
  notes?: string,        // Optional: Notes
  // For 'update' or 'delete':
  vehicleId?: string,    // Required for update/delete
  // For 'delete':
  confirm?: boolean      // Required for delete (must be true)
}
```

#### `vehicle_list`
List all tracked vehicles.
```typescript
{
  // No parameters - returns all vehicles with current odometer
}
```

### Service Records

#### `vehicle_add_service`
Log a service performed on a vehicle. Can include parts inline.
```typescript
{
  vehicleId: string,     // Required: Vehicle ID
  serviceDate: string,   // Required: ISO date (YYYY-MM-DD)
  serviceType: string,   // Required: e.g., 'oil_change', 'tire_rotation'
  odometer?: number,     // Optional: Reading at service (km)
  cost?: number,         // Optional: Total cost
  provider?: string,     // Optional: Where serviced
  notes?: string,        // Optional: Details
  parts?: Array<{        // Optional: Parts used
    partId?: string,     // Use existing part ID, or create new:
    name?: string,       // Part name (for new parts)
    manufacturer?: string,
    partNumber?: string,
    quantity?: number,   // Default: 1
    costPerUnit?: number // Cost at time of service
  }>,
  updateSchedule?: boolean // Optional: Auto-update matching maintenance schedule (default: true)
}
```

#### `vehicle_get_services`
Retrieve service history with filters.
```typescript
{
  vehicleId?: string,    // Optional: Filter by vehicle
  serviceType?: string,  // Optional: Filter by type
  startDate?: string,    // Optional: From date (YYYY-MM-DD)
  endDate?: string,      // Optional: To date (YYYY-MM-DD)
  includeParts?: boolean,// Optional: Include parts details (default: true)
  limit?: number         // Optional: Max results (default: 50)
}
```

#### `vehicle_manage_service`
Update or delete a service record.
```typescript
{
  action: 'update' | 'delete',  // Required
  serviceId: string,     // Required: Service record ID
  // For 'update':
  serviceDate?: string,
  serviceType?: string,
  odometer?: number,
  cost?: number,
  provider?: string,
  notes?: string
}
```

### Parts Management

#### `vehicle_add_part`
Register a part in the database for reuse across services.
```typescript
{
  name: string,          // Required: Part name
  manufacturer?: string, // Optional: Brand (e.g., "NGK")
  model?: string,        // Optional: Model name
  partNumber?: string,   // Optional: Part number (e.g., "94201")
  description?: string,  // Optional: Details
  cost?: number,         // Optional: Unit cost
  url?: string           // Optional: Purchase link
}
```

#### `vehicle_get_parts`
List or search registered parts.
```typescript
{
  search?: string,       // Optional: Search name/manufacturer/partNumber
  limit?: number         // Optional: Max results (default: 50)
}
```

### Maintenance Schedules

#### `vehicle_set_schedule`
Create, update, or delete a maintenance schedule.
```typescript
{
  action: 'create' | 'update' | 'delete',  // Required
  // For 'create':
  vehicleId: string,     // Required for create
  name: string,          // Required: Schedule name (e.g., "Oil Change")
  serviceType: string,   // Required: Matches service record types
  intervalKm?: number,   // Optional: Every X kilometers
  intervalMonths?: number, // Optional: Every X months
  lastPerformedDate?: string,    // Optional: Last service date
  lastPerformedOdometer?: number,// Optional: Odometer at last service
  notes?: string,        // Optional: Notes
  // For 'update' or 'delete':
  scheduleId?: string,   // Required for update/delete
  enabled?: boolean      // Optional: Enable/disable schedule
}
```

#### `vehicle_get_schedules`
List maintenance schedules for a vehicle.
```typescript
{
  vehicleId: string,     // Required: Vehicle ID
  enabledOnly?: boolean  // Optional: Only active schedules (default: true)
}
```

#### `vehicle_get_upcoming`
Calculate what maintenance is due or coming up.
```typescript
{
  vehicleId?: string,    // Optional: Filter by vehicle (default: all)
  withinKm?: number,     // Optional: Due within X km (default: 1000)
  withinMonths?: number  // Optional: Due within X months (default: 1)
}
```
Returns:
- **Overdue items**: Past due date or over km limit
- **Upcoming items**: Within specified thresholds
- **Status for each**: Days/km until due, or how overdue
```

---

## Implementation Plan

### Phase 1: Database Setup
1. Add Vercel Postgres to the project
2. Set up Prisma ORM with schema
3. Run migrations to create tables
4. Create database utility functions

### Phase 2: Core Vehicle & Service Tools
1. Implement `add_vehicle`, `get_vehicles`, `update_vehicle`
2. Implement `add_service_record`, `get_service_history`
3. Test basic CRUD operations

### Phase 3: Parts Tracking
1. Implement `add_part`, `get_parts`
2. Implement `link_part_to_service`
3. Update `add_service_record` to support inline part creation

### Phase 4: Maintenance Schedules
1. Implement `set_maintenance_schedule`, `get_maintenance_schedules`
2. Implement `get_upcoming_maintenance` with due date calculation
3. Auto-update schedules when relevant services are logged

### Phase 5: Polish & Testing
1. Add data validation and error handling
2. Update homepage documentation
3. Test all tools via MCP Inspector
4. Deploy and verify on production

---

## Example Usage Scenarios

### Scenario 1: Log an oil change with parts
```
User: I just got an oil change done at Supercheap Auto
Claude: [Uses add_service_record]
- serviceType: "oil_change"
- serviceDate: "2024-12-12"
- cost: 89.95
- provider: "Supercheap Auto"
- odometer: 45000
- parts: [
    { name: "Engine Oil 5W-30", manufacturer: "Castrol", quantity: 5, cost: 12.99 },
    { name: "Oil Filter", manufacturer: "Ryco", partNumber: "Z79A", cost: 14.99 }
  ]
```

### Scenario 2: Check upcoming maintenance
```
User: What maintenance is due on my car?
Claude: [Uses get_upcoming_maintenance]
Response:
- Oil change: OVERDUE (due at 40,000 km, currently 45,000 km)
- Tire rotation: Due in 500 km (at 45,500 km)
- Air filter: Due in 2 months (April 2025)
```

### Scenario 3: Track spark plug replacement
```
User: I replaced the spark plugs with NGK 94201 SILZKGR8B8S Laser Iridium
Claude: [Uses add_part then add_service_record]
- Creates part: NGK 94201 (SILZKGR8B8S) Laser Iridium
- Creates service record with part linked
- Updates maintenance schedule for spark_plugs
```

---

## File Structure

```
src/
├── lib/
│   ├── redis.ts           # Existing Redis client
│   ├── db.ts              # New Prisma client
│   └── vehicle/
│       ├── types.ts       # TypeScript types
│       ├── schema.ts      # Zod schemas for validation
│       └── queries.ts     # Database query functions
├── app/
│   └── api/
│       └── mcp/
│           └── route.ts   # Add vehicle maintenance tools
prisma/
└── schema.prisma          # Database schema
```

---

## Sources

- [Best Free Database Providers 2024](https://noahflk.com/blog/best-free-database-providers)
- [Vercel vs Supabase Comparison](https://hrekov.com/blog/vercel-vs-supabase-database-comparison)
- [Best Car Maintenance Apps](https://www.ridester.com/car-maintenance-apps/)
- [Simply Auto vs Fuelly](http://simplyauto.app/test/blog/fuelly-alternative.html)
- [Fleet Maintenance Software](https://www.fleetio.com/blog/vehicle-maintenance-log-software)
