# Multi-Tenant Cloud Architecture for Removal Management System

## Executive Summary

This document outlines the complete multi-tenant SaaS architecture for the Removal Management System. The system is designed to support multiple removal companies (tenants) on a single infrastructure while maintaining complete data isolation and customization per company.

**Key Principle**: 10% effort now prevents 1000% pain later. Multi-tenancy must be built into the foundation.

---

## System Architecture Overview

### Core Tenant Structure

```
Company (Tenant)
  ├── Users (with roles)
  ├── Agents (shipping lines, airlines, partners)
  ├── Customers
  ├── Leads & Quotes
  ├── Moves (Master Records)
  │   ├── Packing Jobs
  │   ├── Transport Jobs
  │   ├── Freight Bookings (SEA/AIR)
  │   ├── Customs Clearance
  │   ├── Storage
  │   └── Final Delivery
  ├── Containers (Groupage)
  ├── Warehouse Operations
  ├── Inventory & Materials
  ├── Crew Management
  └── Financials & Profit Tracking
```

---

## Seven Major Engines

### 1️⃣ CRM & Sales Engine

**Purpose**: Lead-to-customer conversion pipeline

**Tables**:
- `leads` - Lead capture with source tracking
- `surveys` - Pre-move surveys with volume estimation
- `survey_items` - Room-by-room inventory
- `quotes` - Multi-currency quotations
- `quote_items` - Itemized pricing

**Features**:
- Lead scoring and qualification
- Survey scheduling (video/in-person/virtual)
- Volume and packing material estimation
- Multi-currency quotation
- Quote validity tracking (default 30 days)
- Conversion tracking (lead → quote → move)
- Supports: Domestic, International Inbound, International Outbound

**Workflow**:
```
Lead Captured → Survey Scheduled → Survey Completed → Quote Generated →
Quote Sent → Quote Accepted → Move Created
```

---

### 2️⃣ Move Management Engine (CENTRAL HUB)

**Purpose**: Master record for all operations. Everything revolves around the MOVE.

**Tables**:
- `moves` - Master move record
- `move_milestones` - Tracking checkpoints
- `move_timeline` - Event log
- `move_documents` - All documents in one place
- `move_costs` - All cost line items
- `move_revenue` - All revenue line items

**Move Types**:
1. **Domestic Move**
   - Origin location → Destination location (within India)
   - May include: packing, local transport, storage, delivery

2. **International Inbound**
   - Origin Country → Indian Port/Airport → Destination in India
   - Includes: freight, customs, port handling, delivery

3. **International Outbound**
   - Origin in India → Indian Port/Airport → Destination Country
   - Includes: packing, origin handling, freight, customs

**Move Status Flow**:
```
draft → confirmed → packing_scheduled → packing_complete →
in_transit → customs_clearance → warehouse_received →
delivery_scheduled → delivered → closed
```

**Key Fields**:
- Move number (auto-generated: MV-2024-0001)
- Move type (domestic/inbound/outbound)
- Customer reference
- Origin and destination details
- Dates: booked, packed, shipped, delivered
- Volume (CBM) and weight (KG)
- Transport mode (SEA/AIR/ROAD)
- Container allocation (if groupage)
- Financial summary (cost, revenue, profit)
- Status and milestones

**Why Move is Central**:
- Single source of truth
- All documents attached to move
- All costs allocated to move
- All crew assignments linked to move
- All warehouse operations linked to move
- Profit calculated per move
- Customer sees ONE move number for entire journey

---

### 3️⃣ Freight Engine

**Purpose**: SEA and AIR freight management with smart pricing

**Already Implemented**:
- ✅ Transport mode layer (SEA/AIR)
- ✅ CBM-based pricing for SEA
- ✅ KG-based pricing for AIR (chargeable weight logic)
- ✅ Rate sheets with slab pricing
- ✅ Groupage containers
- ✅ Location management (ports & airports)
- ✅ Container utilization tracking

**Ports Supported**:
- Jawaharlal Nehru Port (JNPT)
- Chennai Port
- Kolkata Port

**Airports Supported**:
- Mumbai (BOM)
- Delhi (DEL)
- Bangalore (BLR)
- Chennai (MAA)
- Kolkata (CCU)
- Hyderabad (HYD)

**Pricing Logic**:
- **SEA**: Slab-based on CBM (0-5, 5-10, 10-20, 20+)
- **AIR**: Slab-based on chargeable weight (MAX of gross weight and volumetric weight)
- Volumetric weight = CBM × 167 kg (IATA standard)
- Delivery charges based on destination city
- Manual trucking cost override available

**Integration with Moves**:
- Move references container (if groupage)
- Move stores freight cost and revenue
- Container allocation is automatic based on CBM/KG
- Pro-rata cost allocation for groupage

---

### 4️⃣ Warehouse & Storage Engine

**Purpose**: GRN management and storage billing

**Tables**:
- `grn_entries` - Goods Received Notes
- `warehouse_locations` - Physical location mapping
- `storage_billing` - Automated billing records
- `warehouse_stock` - Current stock view

**Features**:
- Auto GRN numbering (GRN-2024-0001)
- CBM-based storage
- Free storage days (configurable per company)
- Automated billing after free period
- Daily/weekly/monthly billing cycles
- Location-based inventory
- Stock visibility per move

**Storage Billing Logic**:
```
Free Days = 7 (configurable)
After free period:
  Daily rate = (Total CBM × Rate per CBM per day)
  OR
  Monthly rate = (Total CBM × Rate per CBM per month)
```

**Workflow**:
```
Container Arrives → GRN Created → Stock Placed in Location →
Free Period Starts → After Free Period → Auto-Billing Triggered →
Customer Notified → Delivery Scheduled → Stock Released
```

---

### 5️⃣ Inventory & Materials Engine

**Purpose**: Track packing materials and auto-deduction

**Tables**:
- `inventory_items` - Master list of materials
- `inventory_transactions` - Stock movements
- `inventory_alerts` - Low stock warnings
- `packing_job_materials` - Materials used per job

**Standard Materials**:
1. Cartons (various sizes)
2. Bubble roll (meters)
3. Corrugated sheets
4. Stretch film (rolls)
5. Masking tape
6. Newspaper (reams)
7. Wooden crates
8. Foam sheets

**Features**:
- Stock level tracking
- Low stock alerts (configurable threshold)
- Auto-deduction when packing job closed
- Material cost allocation to move
- Supplier management
- Purchase order tracking

**Auto-Deduction Logic**:
```
When packing job status = 'completed':
  - Deduct estimated materials from inventory
  - Add actual materials used (if surveyor updated)
  - Allocate material cost to move
  - Trigger low stock alert if below threshold
```

---

### 6️⃣ Crew & Operations Engine

**Purpose**: Crew scheduling and job assignment

**Tables**:
- `crew_members` - Employee/contractor database
- `crew_availability` - Calendar of availability
- `crew_assignments` - Jobs assigned to crew
- `crew_timesheets` - Daily time tracking
- `crew_costs` - Cost per job

**Features**:
- Availability calendar
- Skill-based assignment (packing, loading, driving)
- Cost per day per crew member
- Overtime calculation
- Move-day checklist
- Job completion confirmation
- Performance tracking

**Crew Types**:
1. **Packers** - Material handling and packing
2. **Loaders** - Heavy lifting and container loading
3. **Drivers** - Vehicle operation
4. **Supervisors** - Team management
5. **Carpenters** - Crate building and dismantling

**Cost Structure**:
```
Base Rate per Day = ₹1,000 (configurable)
Overtime Multiplier = 1.5×
Weekend Multiplier = 2×

Total Cost = (Days × Base Rate) + (Overtime Hours × Rate × Multiplier)
```

**Assignment Workflow**:
```
Move Confirmed → Crew Required Calculated →
Available Crew Searched → Crew Assigned →
Notification Sent → Job Day → Timesheet Filled →
Job Completed → Cost Calculated → Allocated to Move
```

---

### 7️⃣ Financial Engine

**Purpose**: Multi-currency profit tracking and management reporting

**Already Implemented**:
- ✅ Multi-currency revenue tracking
- ✅ Exchange rate locking
- ✅ Slab-based pricing
- ✅ Cost allocation
- ✅ Container pro-rata costing
- ✅ Profit per move
- ✅ Profit per container
- ✅ Margin alerts

**Tables**:
- `exchange_rates` - Historical FX rates
- `cost_categories` - Standardized cost types
- `revenue_items` - All revenue line items
- `cost_items` - All cost line items
- `profit_summary` - Aggregated P&L

**Cost Categories**:
1. Freight (SEA/AIR)
2. Origin handling
3. Destination handling
4. Customs clearance
5. Storage
6. Packing materials
7. Crew labor
8. Trucking/transport
9. Insurance
10. Admin/documentation

**Revenue Categories**:
1. Freight charges
2. Packing charges
3. Loading/unloading charges
4. Storage charges
5. Insurance premium
6. Customs brokerage
7. Miscellaneous charges

**Profit Calculation**:
```
Total Revenue (INR) = Σ all revenue items converted to INR
Total Cost (INR) = Σ all cost items converted to INR
Gross Profit = Total Revenue - Total Cost
Profit Margin % = (Gross Profit / Total Revenue) × 100

Alert Triggered if Margin < 15% (configurable threshold)
```

**Reports Available**:
- Profit per move
- Profit per customer
- Profit per container
- Profit per transport mode
- Profit per agent
- Monthly P&L
- Agent performance comparison

---

## Multi-Tenancy Implementation

### Database Design

**Every table MUST include**:
```sql
company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE
```

**Row Level Security (RLS) Policy Template**:
```sql
-- Read Policy
CREATE POLICY "users_can_view_company_data"
  ON table_name FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Write Policy
CREATE POLICY "users_can_manage_company_data"
  ON table_name FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

**Index Requirements**:
```sql
-- ALWAYS create index on company_id + primary query field
CREATE INDEX idx_table_company ON table_name(company_id, status);
CREATE INDEX idx_table_company_date ON table_name(company_id, created_at);
```

### User Management

**User-Company Relationship**:
- Users can belong to multiple companies
- Different roles per company
- Active company context for session

**Roles**:
1. **Owner** - Full access, billing, settings
2. **Admin** - Full operational access
3. **Manager** - View all, edit assigned
4. **Operator** - Daily operations
5. **User** - Limited access
6. **Viewer** - Read-only

**Permissions Matrix**:
```
                Owner  Admin  Manager  Operator  User  Viewer
Manage Users      ✓      ✓
Edit Settings     ✓      ✓
Create Moves      ✓      ✓      ✓        ✓       ✓
Edit Moves        ✓      ✓      ✓        ✓       ✓
Delete Moves      ✓      ✓
View Financials   ✓      ✓      ✓
Manage Inventory  ✓      ✓      ✓        ✓
Assign Crew       ✓      ✓      ✓        ✓
View Reports      ✓      ✓      ✓        ✓       ✓     ✓
```

---

## Tally Integration

### Philosophy

**Phase 1-2**: Keep Tally for accounting
**Phase 3+**: Consider internal accounting module

**Why**:
- Tally excels at: GST compliance, tax filings, audit trail
- Our ERP focuses on: Operations, moves, logistics
- Integration via: Journal entry export

### Export Format

**Journal Entry Structure**:
```json
{
  "voucher_type": "Journal",
  "date": "2024-01-15",
  "voucher_number": "MV-2024-0001",
  "narration": "Move revenue and costs",
  "ledger_entries": [
    {
      "ledger_name": "Customer - ABC Corporation",
      "amount": 150000,
      "is_debit": true
    },
    {
      "ledger_name": "Revenue - Freight Services",
      "amount": 127118.64,
      "is_credit": true
    },
    {
      "ledger_name": "GST Output - 18%",
      "amount": 22881.36,
      "is_credit": true
    },
    {
      "ledger_name": "Cost - Agent Charges",
      "amount": 80000,
      "is_debit": true
    },
    {
      "ledger_name": "Shipping Line - Maersk",
      "amount": 80000,
      "is_credit": true
    }
  ]
}
```

**Export Trigger Points**:
- When move is financially closed
- When invoice is generated
- When payment is received
- Monthly summary export
- On-demand export

**CSV Export Format**:
```csv
Date,Voucher Type,Voucher No,Ledger,Debit,Credit,Narration
2024-01-15,Journal,MV-2024-0001,Customer - ABC Corp,150000,,Move freight charges
2024-01-15,Journal,MV-2024-0001,Revenue - Freight,,127118.64,Revenue recognition
2024-01-15,Journal,MV-2024-0001,GST Output - 18%,,22881.36,Output GST
```

---

## Company Onboarding Flow

### Step 1: Company Registration
- Company name and code
- Primary contact details
- Address information
- Subscription plan selection

### Step 2: Configuration
- Base currency (INR/USD/EUR)
- Financial year start month
- Time zone
- Auto-numbering prefixes

### Step 3: Users & Roles
- Add admin users
- Set up role structure
- Invite team members

### Step 4: Business Setup
- Add agents (shipping lines, airlines)
- Set up rate sheets
- Configure storage rates
- Set up crew members

### Step 5: Integrations (Optional)
- Tally export settings
- Email notifications
- SMS/WhatsApp alerts

### Step 6: Go Live
- Import existing data (optional)
- First move creation
- Onboarding complete

---

## Migration Strategy for Existing Tables

### Tables Requiring company_id

**CRM & Sales**:
- customers ✓ (already has company_id concept via relationships)
- leads (new)
- surveys (new)
- quotes (exists, needs company_id)

**Move Management**:
- moves (new - master table)

**Freight & Operations**:
- containers ✓ (exists)
- groupage_containers ✓ (exists)
- container_shipments ✓ (exists)
- shipment_drafts ✓ (exists)
- rate_sheets ✓ (exists)
- rate_sheet_slabs ✓ (exists)

**Warehouse**:
- All warehouse tables (new)

**Inventory**:
- All inventory tables (new)

**Crew**:
- All crew tables (new)

**Financial**:
- exchange_rates ✓ (exists, may need company_id)
- profit tracking tables (new)

### Migration Script Template

```sql
-- Add company_id to existing table
ALTER TABLE existing_table
  ADD COLUMN IF NOT EXISTS company_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES companies(id) ON DELETE CASCADE;

-- Make it NOT NULL after default is set
ALTER TABLE existing_table
  ALTER COLUMN company_id SET NOT NULL;

-- Remove default for future inserts
ALTER TABLE existing_table
  ALTER COLUMN company_id DROP DEFAULT;

-- Create index
CREATE INDEX idx_existing_table_company
  ON existing_table(company_id);

-- Update RLS policies
DROP POLICY IF EXISTS "old_policy" ON existing_table;
CREATE POLICY "company_scoped_access"
  ON existing_table FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

---

## Next Implementation Steps

### Phase 1: Foundation (Completed)
- ✅ Multi-tenant infrastructure
- ✅ Companies and users tables
- ✅ RLS helper functions

### Phase 2: Core Engines (Current)
1. Create Move Management Engine (master hub)
2. Create Crew & Operations Engine
3. Create Inventory & Materials Engine
4. Create Warehouse & Storage Engine

### Phase 3: Integration
1. Add company_id to existing tables
2. Migrate existing data to default company
3. Update all RLS policies
4. Create Tally export functions

### Phase 4: UI & UX
1. Company onboarding wizard
2. Company switcher (for multi-company users)
3. Dashboard per engine
4. Reports and analytics

### Phase 5: Advanced Features
1. API for external integrations
2. Mobile app for crew
3. Customer portal
4. Agent portal

---

## Success Metrics

### Operational KPIs
- Moves per month
- Container utilization %
- Average move profit margin
- Quote conversion rate
- Average delivery time

### Financial KPIs
- Monthly revenue
- Monthly profit
- Profit per move
- Cost per CBM
- Revenue per employee

### Customer KPIs
- Customer satisfaction score
- Repeat customer rate
- Quote response time
- On-time delivery %
- Damage/claim rate

---

## Conclusion

This multi-tenant architecture provides:
- **Scalability**: Support unlimited companies on single infrastructure
- **Isolation**: Complete data separation per company
- **Customization**: Per-company settings and workflows
- **Security**: RLS enforces access control
- **Flexibility**: Easy to add new features per tenant
- **Future-Proof**: Built for growth from day one

The 10% extra effort invested now in multi-tenancy will save 1000% pain later when scaling to multiple customers.
