# Complete Move Types Guide

## Everything Revolves Around MOVE

The **Move** is the central hub of the entire system. Every operation, cost, revenue, document, and crew assignment is linked to a move. This provides:

- **Single source of truth** - One move number for the entire journey
- **Complete visibility** - Customer and team see all activities in one place
- **Accurate costing** - All costs and revenue allocated to move for profit calculation
- **Audit trail** - Complete timeline of all events and changes

---

## Move Type Hierarchy

### 1. OFFICE SHIFTING 🏢

Moving commercial offices, businesses, or corporate facilities.

**Subtypes**:
- `office_local` - Within same city (< 100 km)
- `office_domestic` - Intercity/interstate within India
- `office_international` - Cross-border office relocation

**Key Characteristics**:
- `is_office_shifting = true`
- Requires detailed office inventory
- Often requires after-hours or weekend moves
- May include IT infrastructure and specialized equipment
- Department-wise organization and labeling
- Network and server relocation considerations

**Special Tables**:
- `move_office_details` - Stores office-specific requirements
  - Number of workstations, cabins, meeting rooms
  - IT equipment count (servers, computers, printers)
  - Departments and employee count
  - Floor plans (origin and destination)
  - Specialized equipment lists
  - Security and access requirements
  - Labeling and color-coding systems

**Example**:
```sql
INSERT INTO moves (
  move_number, move_type, move_subtype,
  is_office_shifting, customer_name,
  origin_city, destination_city
) VALUES (
  'MV-2024-0001', 'domestic', 'office_domestic',
  true, 'TechCorp Solutions',
  'Mumbai', 'Bangalore'
);

INSERT INTO move_office_details (
  move_id, office_name, company_name,
  number_of_employees, number_of_workstations,
  number_of_servers, requires_it_support
) VALUES (
  'move-uuid', 'TechCorp HQ', 'TechCorp Solutions Pvt Ltd',
  150, 120, 5, true
);
```

---

### 2. LOCAL MOVE 🏘️

Household move within the same city or nearby area.

**Characteristics**:
- `is_local_move = true`
- `is_within_city = true`
- `distance_km < 100`
- `move_subtype = 'household_local'`
- Usually same-day or next-day delivery
- Road transport only
- Typically less complex customs/documentation

**Pricing Considerations**:
- Charged by volume (CBM) or fixed truck rate
- Multiple trips possible for same-day service
- Crew cost usually per day
- Minimal storage requirements

**Example**:
```sql
INSERT INTO moves (
  move_number, move_type, move_subtype,
  is_local_move, is_within_city, distance_km,
  customer_name, origin_city, destination_city,
  transport_mode
) VALUES (
  'MV-2024-0002', 'domestic', 'household_local',
  true, true, 25,
  'Sharma Family', 'Mumbai', 'Mumbai',
  'ROAD'
);
```

---

### 3. DOMESTIC MOVE 🚚

Intercity or interstate household move within India.

**Characteristics**:
- `move_type = 'domestic'`
- `move_subtype = 'household_domestic'`
- `origin_country = 'India'`
- `destination_country = 'India'`
- Multiple days in transit
- May require temporary storage
- Can use road or rail transport

**Journey Flow**:
```
Origin Home → Packing → Loading → Transit (1-7 days) →
Storage (optional) → Final Delivery → Unpacking
```

**Pricing Components**:
1. Packing material cost
2. Packing labor (crew × days)
3. Loading charges
4. Road freight (per CBM or truck basis)
5. Unloading charges
6. Storage charges (if applicable, after free days)
7. Final delivery charges
8. Unpacking charges (optional)

**Example**:
```sql
INSERT INTO moves (
  move_number, move_type, move_subtype,
  customer_name,
  origin_city, origin_state,
  destination_city, destination_state,
  transport_mode, estimated_volume_cbm,
  requires_packing, requires_storage
) VALUES (
  'MV-2024-0003', 'domestic', 'household_domestic',
  'Patel Family',
  'Delhi', 'Delhi',
  'Pune', 'Maharashtra',
  'ROAD', 35.5,
  true, true
);
```

---

### 4. AUTOMOBILE SHIFTING 🏍️🚗

Vehicle-only moves: motorcycles, cars, or both.

**Vehicle Types Supported**:
- Motorcycle / Motorbike
- Scooter
- Car (sedan)
- SUV
- Van

**Characteristics**:
- `includes_vehicles = true`
- `move_subtype = 'vehicle_only'` (when no household goods)
- Can be domestic or international
- Requires special handling and documentation

**Vehicle Details Tracked**:
- Make, model, year, color
- Registration number and VIN
- Running condition and fuel level
- Pre and post-shipment photos
- Damage documentation
- Insurance details
- Customs value (for international)

**Shipping Methods**:
1. **RoRo (Roll-on/Roll-off)** - Vehicle driven on/off ship
2. **Container (Shared)** - Multiple vehicles in one container
3. **Container (Dedicated)** - Single vehicle in exclusive container
4. **Flatbed Truck** - Open transport
5. **Covered Truck** - Enclosed transport

**Default CBM by Vehicle Type**:
- Motorcycle/Scooter: 1.5 CBM
- Car: 6 CBM
- SUV: 8 CBM
- Van: 10 CBM

**Example - Vehicle Only**:
```sql
-- Create move
INSERT INTO moves (
  move_number, move_type, move_subtype,
  includes_vehicles, number_of_vehicles,
  customer_name, origin_city, destination_city
) VALUES (
  'MV-2024-0004', 'domestic', 'vehicle_only',
  true, 2,
  'Kumar Auto Transport',
  'Mumbai', 'Delhi'
);

-- Add motorcycle
INSERT INTO move_vehicles (
  move_id, vehicle_type, make, model, year,
  registration_number, vehicle_condition,
  is_running, shipping_method
) VALUES (
  'move-uuid', 'motorcycle', 'Royal Enfield', 'Classic 350', 2022,
  'MH-01-AB-1234', 'excellent',
  true, 'covered_truck'
);

-- Add car
INSERT INTO move_vehicles (
  move_id, vehicle_type, make, model, year,
  registration_number, vehicle_condition,
  shipping_method
) VALUES (
  'move-uuid', 'car', 'Honda', 'City', 2020,
  'MH-02-CD-5678', 'good',
  'flatbed_truck'
);
```

---

### 5. INTERNATIONAL INBOUND 📦➡️🇮🇳

Moving goods FROM overseas TO India.

**With or Without Vehicles**:
- Can include household goods only
- Can include vehicles only
- Can include both household goods AND vehicles

**Characteristics**:
- `move_type = 'international_inbound'`
- `origin_country != 'India'`
- `destination_country = 'India'`
- Requires customs clearance in India
- May use SEA or AIR freight
- Delivery from Indian port/airport to final destination

**Journey Flow**:
```
Origin Country → Port/Airport of Loading →
SEA/AIR Transit → Indian Port/Airport →
Customs Clearance → Warehouse (if needed) →
Final Delivery to Destination City
```

**Key Documents**:
- Bill of Lading (SEA) or Airway Bill (AIR)
- Packing list
- Invoice
- Customs declaration
- Insurance certificate
- Transfer of Residence (ToR) documents (if applicable)

**Pricing Components**:
1. Origin handling charges (overseas)
2. Freight charges (SEA CBM-based or AIR kg-based)
3. Port/airport charges in India
4. Customs clearance fees
5. Customs duty (if applicable)
6. Storage (after free days)
7. Trucking to final destination
8. Delivery and unpacking

**Example - Household + Car Inbound**:
```sql
-- Create move
INSERT INTO moves (
  move_number, move_type, move_subtype,
  customer_name,
  origin_city, origin_country,
  destination_city, destination_country,
  transport_mode, estimated_volume_cbm,
  includes_vehicles, requires_customs
) VALUES (
  'MV-2024-0005', 'international_inbound', 'mixed_household_vehicle',
  'Smith Family',
  'Dubai', 'UAE',
  'Mumbai', 'India',
  'SEA', 45.0,
  true, true
);

-- Add vehicle
INSERT INTO move_vehicles (
  move_id, vehicle_type, make, model, year,
  registration_number, customs_value_declared,
  shipping_method, requires_enclosed_container
) VALUES (
  'move-uuid', 'car', 'Toyota', 'Camry', 2021,
  'DXB-12345', 250000,
  'container_shared', false
);
```

---

### 6. INTERNATIONAL OUTBOUND 🇮🇳➡️📦

Moving goods FROM India TO overseas destination.

**With or Without Vehicles**:
- Household goods export
- Vehicle export
- Both household goods AND vehicles

**Characteristics**:
- `move_type = 'international_outbound'`
- `origin_country = 'India'`
- `destination_country != 'India'`
- Requires Indian export customs clearance
- May use SEA or AIR freight
- Packing and origin handling in India

**Journey Flow**:
```
Origin City in India → Packing → Loading →
Transport to Indian Port/Airport →
Export Customs Clearance → SEA/AIR Transit →
Destination Port/Airport → Destination Customs →
Final Delivery (handled by destination agent)
```

**Pricing Components**:
1. Packing material and labor
2. Transport to Indian port/airport
3. Port/airport handling charges
4. Export customs clearance
5. Freight charges (SEA/AIR)
6. Insurance
7. Destination charges (handled by agent or customer)

**Example - Household + Motorcycle Outbound**:
```sql
-- Create move
INSERT INTO moves (
  move_number, move_type, move_subtype,
  customer_name,
  origin_city, origin_country,
  destination_city, destination_country,
  transport_mode, estimated_volume_cbm,
  includes_vehicles, requires_customs
) VALUES (
  'MV-2024-0006', 'international_outbound', 'mixed_household_vehicle',
  'Gupta Family',
  'Bangalore', 'India',
  'Singapore', 'Singapore',
  'SEA', 38.0,
  true, true
);

-- Add motorcycle
INSERT INTO move_vehicles (
  move_id, vehicle_type, make, model, year,
  registration_number, customs_value_declared,
  shipping_method
) VALUES (
  'move-uuid', 'motorcycle', 'Bajaj', 'Pulsar', 2023,
  'KA-03-MN-9876', 80000,
  'container_shared'
);
```

---

## Move Subtype Auto-Detection

The system automatically sets `move_subtype` based on these rules:

```
IF is_office_shifting = true:
  IF is_local_move OR distance < 100km → 'office_local'
  ELSE IF move_type = 'domestic' → 'office_domestic'
  ELSE → 'office_international'

ELSE IF includes_vehicles = true AND estimated_volume_cbm = 0:
  → 'vehicle_only'

ELSE IF includes_vehicles = true:
  IF is_office_shifting → 'mixed_office_vehicle'
  ELSE → 'mixed_household_vehicle'

ELSE:
  IF is_local_move → 'household_local'
  ELSE IF move_type = 'domestic' → 'household_domestic'
  ELSE → 'household_international'
```

---

## Complete Move Subtypes Reference

| Subtype | Description |
|---------|-------------|
| `household_local` | Local household move within city |
| `household_domestic` | Intercity/interstate household move |
| `household_international` | International household move |
| `office_local` | Local office shifting within city |
| `office_domestic` | Intercity/interstate office shifting |
| `office_international` | International office relocation |
| `vehicle_only` | Only vehicles, no household/office goods |
| `mixed_household_vehicle` | Household goods + vehicles |
| `mixed_office_vehicle` | Office goods + vehicles |

---

## Move Status Flow

All moves follow this general status progression:

```
draft → confirmed → survey_scheduled → survey_completed →
packing_scheduled → packing_in_progress → packing_complete →
freight_booked (if applicable) → in_transit →
customs_clearance (if international) →
warehouse_received (if storage) →
delivery_scheduled → out_for_delivery → delivered → closed
```

**Can be cancelled at any stage**: `cancelled`

---

## Financial Tracking Per Move

Every move tracks:

**Revenue Items** (from customer):
- Freight charges
- Packing charges
- Loading/unloading charges
- Storage charges
- Insurance premium
- Customs brokerage
- Delivery charges
- Miscellaneous charges

**Cost Items** (to suppliers/agents):
- Freight cost (shipping line/airline)
- Origin handling charges
- Destination handling charges
- Customs clearance cost
- Storage cost
- Packing materials cost
- Crew labor cost
- Trucking cost
- Insurance cost

**Auto-Calculated**:
```
Total Revenue (INR) = Sum of all revenue items converted to INR
Total Cost (INR) = Sum of all cost items converted to INR
Gross Profit = Revenue - Cost
Profit Margin % = (Profit / Revenue) × 100
```

**Alert triggered if margin < 15%** (configurable per company)

---

## Key Benefits of Move-Centric Design

1. **Single Reference Number**: Customer sees one move number throughout journey
2. **Consolidated Documents**: All documents attached to move
3. **Accurate Costing**: All costs allocated properly
4. **Profit Visibility**: Real-time profit calculation
5. **Complete Timeline**: Full audit trail of all activities
6. **Customer Experience**: Everything in one place
7. **Operational Clarity**: Team knows exactly what needs to be done
8. **Reporting**: Easy to generate reports by move type, customer, profit, etc.

---

## Database Views

**`move_summary` view** provides complete overview:
- All move details
- Vehicle count (motorcycles vs cars)
- Total vehicle CBM
- Office details (if applicable)
- Cost and revenue item counts
- Document count
- Milestone completion progress

Use this view for dashboards, reports, and listings.

---

## Best Practices

1. **Always create move first**, then add related records (vehicles, office details, costs, revenue)
2. **Use proper move_subtype** to ensure correct pricing and workflow
3. **Track all vehicles individually** in `move_vehicles` table for proper insurance and customs
4. **Update move status** as operations progress to keep timeline accurate
5. **Add milestones** for better tracking and customer communication
6. **Lock exchange rates** when booking to avoid FX risk
7. **Attach all documents** to move for easy access and compliance
8. **Review profit margin** before confirming move to ensure profitability

---

## Summary

Everything in the system revolves around the **MOVE**. Whether it's:
- A small local household move
- A large office shifting
- Vehicle transport across borders
- International relocation with household goods and cars

All operations, costs, documents, crew assignments, and financials are linked to the move, providing complete visibility and accurate profit tracking.
