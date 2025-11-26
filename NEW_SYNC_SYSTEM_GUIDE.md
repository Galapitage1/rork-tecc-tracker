# New Multi-Device Sync System

## Overview
This project now uses a comprehensive, efficient sync system that ensures data consistency across multiple devices while preventing data loss and reducing unnecessary network calls.

## Sync Architecture

### 1. **On App Load (Before Login)**
- Syncs ONLY essential data:
  - Users
  - MOIR users  
  - Outlets
- Uses `syncIn()` to fetch latest data from server
- Merges with local data
- Runs once during app initialization

### 2. **On User Login**
- Triggers full data sync for ALL endpoints:
  - Products
  - Product conversions
  - Pending requests
  - History (stock checks)
  - Customers
  - Recipes
  - Stores
  - Production
  - Orders
  - Inventory data
  - Live inventory data
  - Suppliers
  - GRN
  - Reconciliation data
  - Campaign settings
- Uses `fullSync()` with `direction: 'both'` to ensure local and server are in sync
- Only syncs differences (items with newer timestamps)

### 3. **Sync Out (Push to Server)**
Triggered automatically when:
- Stock check submitted or edited
- Request submitted or edited
- Customer created or edited
- Recipe added or edited
- Product added or edited
- Unit conversion added or edited
- Reconciliation completed
- Order added or edited
- Store added or edited value changed
- Supplier added or edited
- GRN added or edited
- Production added/request approved/deleted
- Inventory or live inventory manually edited

Uses `syncOut()` to immediately push changes to server.

### 4. **60-Second Background Sync**
- Runs silently every 60 seconds
- Uses `backgroundSyncIn()` to fetch ONLY newer data
- Compares `updatedAt` timestamps
- Minimal network overhead
- Non-blocking UI
- Merges newer items into local data

### 5. **Manual "Sync Now" Button**
- Fetches new data from server for all endpoints
- Uses `syncIn()` with `onlyNewer: true`
- Merges newer data into local
- Shows sync progress to user
- Does NOT override local uncommitted changes

### 6. **Manual "Over-ride Data" Button**
- Admin/SuperAdmin only
- Forces ALL local data to server using `syncOut()`
- Useful for restoring data or pushing local changes
- Shows warning before execution
- Other devices will get this data on next sync

### 7. **3-Day Data Cleanup**
- Runs automatically on app load
- Checks if 3 days have passed since last cleanup
- Removes old data from:
  - History (keeps last 30 days)
  - Pending requests (keeps last 30 days)
  - Activity logs (keeps last 30 days)
  - Stock checks (keeps last 30 days)
- Prevents local storage bloat
- Does NOT affect server data

## Sync Functions

### `syncOut<T>(endpoint, localData): Promise<void>`
Pushes local data to server. Used when data changes locally.

### `syncIn<T>(endpoint, onlyNewer): Promise<T[]>`
Fetches data from server. Can optionally filter to only newer items.

### `fullSync<T>(endpoint, localData, direction): Promise<T[]>`
Performs bidirectional sync:
- `direction: 'out'` - Push local to server
- `direction: 'in'` - Pull server to local
- `direction: 'both'` - Push then pull

### `backgroundSyncIn<T>(endpoint, localData): Promise<T[]>`
Silent background sync that only fetches newer items based on `updatedAt` timestamp.

### `mergeData<T>(local, remote): Promise<T[]>`
Intelligently merges two datasets:
- Keeps items from both
- Uses newest `updatedAt` for conflicts
- Filters out deleted items

## Benefits

1. **No Data Loss**: Sync-out before sync-in ensures changes aren't lost
2. **Efficient**: Only syncs what changed (background sync)
3. **Fast**: Immediate push when data changes
4. **Reliable**: Multiple devices stay in sync
5. **Clean**: Auto-cleanup prevents storage bloat
6. **User-Friendly**: Shows progress, allows manual control

## File Structure

- `utils/newSyncManager.ts` - New sync system implementation
- `utils/syncManager.ts` - Legacy sync (will be replaced)
- Contexts use new sync functions for all operations

## Migration Notes

- All contexts updated to use new sync system
- Background sync runs automatically every 60 seconds
- Login triggers comprehensive data sync
- All mutations trigger immediate sync-out
- 3-day cleanup runs on app load
