# Sync Fix Summary

## Problem
The app was showing sync errors: `TRPCClientError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

This happened because the app had **TWO different sync systems**:
1. **PHP-based sync** - Working system at `https://tracker.tecclk.com/Tracker/api/` ✅
2. **tRPC-based sync** - Not deployed, causing HTML 404 errors ❌

## Root Cause
Three context files were using the broken `trpcSyncManager.ts` which tried to call tRPC endpoints that don't exist on the server:
- `contexts/StockContext.tsx`
- `contexts/CustomerContext.tsx` 
- `contexts/RecipeContext.tsx`

## Solution Applied
Updated all three contexts to use `newSyncManager.ts` which uses the working PHP sync system:

### Changes Made:

1. **contexts/StockContext.tsx**
   - Changed: `import { syncWithServer } from '@/utils/trpcSyncManager'`
   - To: `import { fullSync } from '@/utils/newSyncManager'`
   - Updated all `syncWithServer()` calls to `fullSync()`

2. **contexts/CustomerContext.tsx**
   - Changed: `import { syncWithServer } from '@/utils/trpcSyncManager'`
   - To: `import { fullSync } from '@/utils/newSyncManager'`
   - Updated all `syncWithServer()` calls to `fullSync()`

3. **contexts/RecipeContext.tsx**
   - Changed: `import { syncWithServer } from '@/utils/trpcSyncManager'`
   - To: `import { fullSync } from '@/utils/newSyncManager'`
   - Updated all `syncWithServer()` calls to `fullSync()`

## How the PHP Sync Works

The working sync system uses these files:
- **Client side**: `utils/newSyncManager.ts`
- **Server side**: 
  - `public/Tracker/api/sync.php` - Merges and saves data
  - `public/Tracker/api/get.php` - Retrieves data
- **Storage**: JSON files in `public/Tracker/data/` directory

### Sync Process:
1. Client sends local data to `sync.php`
2. Server merges with existing data (newest timestamp wins)
3. Server returns merged data
4. Client updates local storage with merged data

## Users & Outlets Import/Export
The user also asked about import/export for users and outlets - this is **already implemented**:

### Existing Features:
- ✅ Export users to Excel: `utils/usersExporter.ts`
- ✅ Import users from Excel: Parses Excel and adds to system
- ✅ Export outlets to Excel: `utils/outletsExporter.ts`  
- ✅ Import outlets from Excel: Parses Excel and adds to system
- ✅ UI buttons in Settings page for import/export

## Expected Results
After this fix:
- ✅ No more "Unexpected token '<'" errors
- ✅ Products sync across devices
- ✅ Customers sync across devices
- ✅ Recipes sync across devices
- ✅ Stock checks sync across devices
- ✅ Requests sync across devices
- ✅ Outlets sync across devices
- ✅ Inventory sync across devices
- ✅ All data syncs every 60 seconds automatically
- ✅ Manual "Sync Now" button works correctly

## Testing
To verify the fix:
1. Open the app on Device A
2. Add a new product/customer/recipe
3. Open the app on Device B
4. Press "Sync Now" in Settings
5. The new data should appear on Device B
6. Changes made on Device B should sync back to Device A

## Environment Configuration
Make sure `.env` has:
```
EXPO_PUBLIC_FILE_SYNC_URL=https://tracker.tecclk.com/Tracker/api
EXPO_PUBLIC_RORK_API_BASE_URL=https://tracker.tecclk.com
```

The sync system will automatically use the FILE_SYNC_URL for data synchronization.
