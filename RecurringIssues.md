# Recurring Issues

## RFP Management>Saving

### Issue Description
When creating a new RFP, the system encounters an error with UUID handling:
```
invalid input syntax for type uuid: "undefined"
```

### Root Cause
The issue occurs when trying to explicitly set UUIDs during RFP creation instead of letting Supabase handle UUID generation through its default values.

### Attempted Fixes

1. **Initial Fix Attempt**
   - Manually generated UUIDs using uuidv4()
   - Issue: UUID was still being passed as undefined in some cases

2. **Second Fix Attempt**
   - Added UUID validation function
   - Pre-generated UUIDs before database operations
   - Issue: Race condition between UUID generation and database insert

3. **Third Fix Attempt**
   - Removed manual UUID generation
   - Let Supabase handle UUID generation through DEFAULT values
   - Removed id field from insert payload
   - Let database handle component IDs as well
   - Changed temporary component IDs to use timestamp-based format instead of UUID
   - Added database triggers to validate and handle UUIDs
   - Added debugging functions to track UUID issues
   - Issue: Still experiencing intermittent UUID errors

4. **Latest Fix Attempt**
   - Added comprehensive UUID validation and cleaning functions
   - Implemented automatic UUID generation in database triggers
   - Added analytics logging for debugging UUID issues
   - Added indexes to improve UUID lookup performance
  - Issue: Still experiencing UUID errors despite fixes

5. **Final Fix - RESOLVED**
  - Removed all manual UUID handling during insert
  - Let Supabase handle UUID and timestamp generation
  - Added more detailed logging for debugging
  - Improved temporary ID generation for components
  - Enhanced condition checking in handleSubmit function to validate ID values
  - Added explicit checks to ensure id is valid before attempting updates
  - Modified condition to: `if (id && id !== 'new' && id !== 'undefined')`
  - Explicitly excluded id, client_id, created_at, and updated_at from the data payload

### Current Status
**RESOLVED** - The issue has been fixed by:

1. Removing all manual UUID handling during insert operations
2. Letting Supabase handle UUID generation through DEFAULT values
3. Removing timestamp fields (created_at, updated_at) from insert/update payloads
4. Adding more detailed logging for debugging
5. Improving temporary ID generation for components
6. Adding explicit validation of ID values before performing database operations
7. Ensuring the SQL query doesn't attempt to use "undefined" as a UUID parameter

### Prevention Measures
- Do not manually set UUID fields that have DEFAULT values in the database
- Let the database handle ID generation
- Always check database constraints and defaults before manual ID assignment
- Use clearly distinguishable temporary IDs for client-side state (e.g., `temp-${timestamp}`)
- When inserting new records, explicitly remove any client-generated IDs from the payload
- Log all UUID-related operations for debugging
- Use database triggers to validate and clean UUIDs
- Implement proper error handling for UUID-related failures
- Add explicit validation checks before attempting database operations with IDs

### Related Files
- src/pages/admin/RFPFormPage.tsx
- supabase/migrations/20250327174047_dark_tower.sql (original schema)
- supabase/migrations/20250408204512_rapid_water.sql (UUID validation)
- supabase/migrations/20250423204027_noisy_poetry.sql (latest fixes)