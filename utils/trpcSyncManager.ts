import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcClient } from '@/lib/trpc';

const LAST_SYNC_KEY = '@last_sync_time';

export async function getLastSyncTime(collection: string): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(`${LAST_SYNC_KEY}_${collection}`);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

export async function setLastSyncTime(collection: string, time: number): Promise<void> {
  try {
    await AsyncStorage.setItem(`${LAST_SYNC_KEY}_${collection}`, time.toString());
  } catch (error) {
    console.error(`[TRPC SYNC] Failed to save last sync time for ${collection}:`, error);
  }
}

export async function syncWithServer<T extends { id: string; updatedAt?: number }>(
  collection: string,
  localData: T[],
  options?: { forceDownload?: boolean }
): Promise<T[]> {
  console.log(`[TRPC SYNC] ${collection}: Starting sync with ${localData.length} local items...`);
  
  try {
    const lastSyncTime = options?.forceDownload ? undefined : await getLastSyncTime(collection);
    
    const result = await trpcClient.sync.syncData.mutate({
      collection,
      data: localData,
      lastSyncTime,
    });
    
    console.log(`[TRPC SYNC] ${collection}: Server returned ${result.data.length} items`);
    
    if (result.data.length > 0 || options?.forceDownload) {
      const merged = mergeData(localData, result.data, options?.forceDownload);
      await setLastSyncTime(collection, result.syncTime);
      console.log(`[TRPC SYNC] ${collection}: ✓ Merged to ${merged.length} items`);
      return merged;
    }
    
    await setLastSyncTime(collection, result.syncTime);
    console.log(`[TRPC SYNC] ${collection}: ✓ No changes from server`);
    return localData;
  } catch (error: any) {
    console.error(`[TRPC SYNC] ${collection}: Error`, error);
    if (error?.data?.stack) {
      console.error(`[TRPC SYNC] ${collection}: Stack:`, error.data.stack);
    }
    if (error?.shape) {
      console.error(`[TRPC SYNC] ${collection}: Shape:`, error.shape);
    }
    console.log(`[TRPC SYNC] ${collection}: Using local data only`);
    return localData;
  }
}

export async function fetchFromServer<T extends { id: string; updatedAt?: number }>(
  collection: string,
  includeAll: boolean = false
): Promise<T[]> {
  console.log(`[TRPC SYNC] ${collection}: Fetching data from server...`);
  
  try {
    const lastSyncTime = includeAll ? undefined : await getLastSyncTime(collection);
    
    const result = await trpcClient.sync.getData.query({
      collection,
      lastSyncTime,
    });
    
    console.log(`[TRPC SYNC] ${collection}: ✓ Fetched ${result.data.length} items`);
    await setLastSyncTime(collection, result.syncTime);
    
    return result.data as T[];
  } catch (error: any) {
    console.error(`[TRPC SYNC] ${collection}: Error fetching`, error);
    if (error?.data?.stack) {
      console.error(`[TRPC SYNC] ${collection}: Stack:`, error.data.stack);
    }
    if (error?.shape) {
      console.error(`[TRPC SYNC] ${collection}: Shape:`, error.shape);
    }
    return [];
  }
}

function mergeData<T extends { id: string; updatedAt?: number; deleted?: boolean }>(
  local: T[],
  remote: T[],
  forceDownload: boolean = false
): T[] {
  const merged = new Map<string, T>();
  
  if (forceDownload && remote.length > 0) {
    console.log('[TRPC MERGE] Force download mode - using remote data only');
    remote.forEach(item => merged.set(item.id, item));
    return Array.from(merged.values()).filter(item => !item.deleted);
  }
  
  local.forEach(item => merged.set(item.id, item));
  
  remote.forEach(item => {
    const existing = merged.get(item.id);
    if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
      merged.set(item.id, item);
    }
  });
  
  return Array.from(merged.values()).filter(item => !item.deleted);
}
