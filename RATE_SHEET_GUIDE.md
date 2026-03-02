# Rate Sheet Management Guide

## Overview

The Rate Sheet Management system allows you to create, manage, and import/export freight rates that can be automatically pulled into quotes. This eliminates the need to manually enter rates every time and ensures consistency across your pricing.

## Features

### 1. Rate Sheet Management
- Create multiple rate sheets for different time periods or service types
- Mark rate sheets as import or export
- Set effective dates to control when rates become active
- Add notes and details about each rate sheet

### 2. Shipping Lanes
Each rate sheet contains shipping lanes with:
- Origin and destination countries/ports
- Service types (FCL, LCL, Air, Road)
- Container types for FCL shipments
- Base rates and surcharges:
  - Base freight rate
  - Fuel surcharge
  - Security fees
  - Terminal handling charges
  - Documentation fees
- Transit times
- Validity periods

### 3. Additional Charges
Define reusable charges that can be applied to shipments:
- Origin, destination, freight, or other charges
- Different unit types:
  - Per shipment
  - Per container
  - Per CBM (cubic meter)
  - Per kilogram
  - Percentage of freight cost
- Mark charges as mandatory to auto-apply them
- Add descriptions for clarity

### 4. Import/Export Functionality
- **Export to CSV**: Download your rate sheets as CSV files for backup or sharing
- **Import from CSV**: Bulk upload rates from CSV files
- Maintains data consistency across systems

### 5. Rate Lookup in Quoting
When creating quotes, you can:
- Search rate sheets by route and service type
- View matching rates with full cost breakdown
- Automatically add freight costs to quote line items
- Include mandatory charges automatically
- Override or adjust rates as needed

## How to Use

### Creating a Rate Sheet

1. Navigate to **Rate Sheets** from the dashboard
2. Click **New Rate Sheet**
3. Enter details:
   - Name (e.g., "Asia-Europe Q1 2024")
   - Type (Import or Export)
   - Currency
   - Effective dates
   - Notes
4. Click **Create Rate Sheet**

### Adding Shipping Lanes

1. Select a rate sheet from the list
2. Click **Add Lane** under Shipping Lanes
3. Fill in the lane details:
   - Origin country and port
   - Destination country and port
   - Service type and container type
   - Base rate and all applicable surcharges
   - Transit days
4. Click **Add Lane**

### Adding Additional Charges

1. Select a rate sheet from the list
2. Click **Add Charge** under Additional Charges
3. Define the charge:
   - Charge name (e.g., "Port Congestion Fee")
   - Type (origin, destination, freight, other)
   - Unit type (how it's calculated)
   - Amount
   - Mark as mandatory if it should auto-apply
4. Click **Add Charge**

### Using Rates in Quotes

1. Create or edit a quote
2. In the Line Items section, click **Search Rate Sheets**
3. Enter your search criteria:
   - Origin and destination details
   - Service type
   - Container type (for FCL)
4. Click **Search Rates**
5. Review the matching rate and cost breakdown
6. Click **Use This Rate in Quote** to add it to your quote
7. The system will automatically:
   - Add the base freight charge
   - Add all surcharges as separate line items
   - Include mandatory additional charges
8. You can still manually adjust quantities or add more items

### Exporting Rate Sheets

1. Select a rate sheet
2. Click **Export CSV**
3. The file downloads with:
   - Rate sheet information
   - All lanes with rates
   - All additional charges
4. Use this for:
   - Backups
   - Sharing with team members
   - Importing into other systems

### Importing Rate Sheets

1. Select a rate sheet (or create a new one)
2. Click **Import CSV**
3. Select your CSV file
4. The system will import all lanes from the file
5. Review imported data for accuracy

## CSV Format

When exporting, the CSV file follows this structure:

```
Rate Sheet: [Name]
Type: [import/export]
Currency: [USD/EUR/etc]

LANES:
Origin Country,Origin Port,Destination Country,Destination Port,Service Type,Container Type,Base Rate,Fuel Surcharge,Security Fee,Terminal Handling,Documentation Fee,Transit Days,Valid From,Valid To
[data rows...]

CHARGES:
Charge Name,Charge Type,Unit Type,Amount,Currency,Mandatory,Description
[data rows...]
```

## Best Practices

1. **Keep Rate Sheets Organized**
   - Use clear naming conventions (route + time period)
   - Set appropriate effective dates
   - Mark old sheets as inactive

2. **Regular Updates**
   - Update rates when you receive new tariffs
   - Set expiry dates on time-sensitive rates
   - Keep a history by creating new sheets instead of editing old ones

3. **Use Mandatory Charges Wisely**
   - Only mark charges as mandatory if they always apply
   - Optional charges can be added manually during quoting

4. **Validate Imported Data**
   - Always review imported rates for accuracy
   - Check that all fields mapped correctly

5. **Backup Your Rates**
   - Export rate sheets regularly as CSV backups
   - Store backups in a secure location

6. **Rate Sheet vs Manual Entry**
   - Use rate sheets for standard, recurring routes
   - Use manual entry for one-off or custom quotes
   - You can combine both methods in a single quote

## Tips

- **Search is flexible**: You can search across all active rate sheets at once
- **Multiple rate sheets**: Have overlapping rate sheets for different service levels
- **Historical data**: Keep old rate sheets inactive for reference
- **Team collaboration**: Export and share rate sheets with team members
- **Quick updates**: Import updated rates from your freight forwarders' rate sheets

## Troubleshooting

**No rates found in search**
- Check that you have active rate sheets for the shipment type
- Verify origin/destination spelling matches exactly
- Ensure the rate validity dates include today's date

**Import fails**
- Check CSV file format matches the export format
- Ensure all required fields are populated
- Verify numeric fields contain valid numbers

**Rates not appearing in quotes**
- Confirm rate sheet is marked as active
- Check effective dates include current date
- Verify the shipment type matches (import vs export)
