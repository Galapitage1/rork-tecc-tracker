import AsyncStorage from '@react-native-async-storage/async-storage';

function getFileSyncBase(): string {
  let base = '';
  
  if (typeof window !== 'undefined') {
    base = (window as any).EXPO_PUBLIC_FILE_SYNC_URL || (window as any).EXPO_FILE_SYNC_URL || '';
    if (base) {
      console.log('[SYNC] Window FILE_SYNC_URL:', base);
    }
  }
  
  if (!base && process.env.EXPO_PUBLIC_FILE_SYNC_URL) {
    base = process.env.EXPO_PUBLIC_FILE_SYNC_URL;
    console.log('[SYNC] Process.env FILE_SYNC_URL:', base);
  }
  
  if (!base) {
    console.log('[SYNC] FILE_SYNC_URL not configured - sync will be skipped');
  }
  
  return base;
}

export const DEVICE_ID_KEY = '@device_id';
const LAST_SYNC_KEY = '@last_sync_time';
const LAST_CLEANUP_KEY = '@last_cleanup_time';

let deviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  
  let stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!stored) {
    stored = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, stored);
  }
  
  deviceId = stored;
  return stored;
}

function cleanDataForSync<T>(data: T): T {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    console.error('[SYNC] cleanDataForSync: Failed to clean data', error);
    throw new Error('Data contains non-serializable values');
  }
}

export async function syncOut<T extends { id: string; updatedAt?: number }>(
  endpoint: string,
  localData: T[]
): Promise<void> {
  const syncBase = getFileSyncBase();
  console.log(`[SYNC OUT] ${endpoint}: Pushing ${localData.length} items to server...`);
  console.log(`[SYNC OUT] ${endpoint}: Sync URL:`, syncBase);
  
  if (!syncBase) {
    console.warn(`[SYNC OUT] ${endpoint}: No sync URL configured`);
    return;
  }

  try {
    const currentDeviceId = await getDeviceId();
    const dataWithMetadata = localData.map(item => ({
      ...item,
      updatedAt: item.updatedAt || Date.now(),
      deviceId: currentDeviceId,
    }));
    const cleaned = cleanDataForSync(dataWithMetadata);

    const syncUrl = syncBase.replace(/\/$/, '') + `/sync.php?endpoint=${encodeURIComponent(endpoint)}`;
    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleaned),
    });
    
    if (!res.ok) {
      console.error(`[SYNC OUT] ${endpoint}: Failed with status ${res.status}`);
      throw new Error(`Sync out failed: ${res.status}`);
    }
    
    console.log(`[SYNC OUT] ${endpoint}: ✓ Successfully pushed ${cleaned.length} items`);
  } catch (error) {
    console.error(`[SYNC OUT] ${endpoint}: Error`, error);
    throw error;
  }
}

export async function syncIn<T extends { id: string; updatedAt?: number }>(
  endpoint: string,
  onlyNewer: boolean = false
): Promise<T[] | null> {
  const syncBase = getFileSyncBase();
  console.log(`[SYNC IN] ${endpoint}: Fetching from server... (onlyNewer: ${onlyNewer})`);
  console.log(`[SYNC IN] ${endpoint}: Sync URL:`, syncBase);
  
  if (!syncBase) {
    console.warn(`[SYNC IN] ${endpoint}: No sync URL configured`);
    return null;
  }

  try {
    const url = syncBase.replace(/\/$/, '') + `/get.php?endpoint=${encodeURIComponent(endpoint)}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error(`[SYNC IN] ${endpoint}: Failed with status ${res.status}`);
      return null;
    }
    
    const responseText = await res.text();
    try {
      const data = JSON.parse(responseText);
      const serverData: T[] = Array.isArray(data) ? data : [];
      console.log(`[SYNC IN] ${endpoint}: ✓ Got ${serverData.length} items from server`);
      
      if (onlyNewer && serverData.length > 0) {
        const lastSyncTime = await getLastSyncTime(endpoint);
        const newerItems = serverData.filter(item => 
          (item.updatedAt || 0) > lastSyncTime
        );
        console.log(`[SYNC IN] ${endpoint}: Filtered to ${newerItems.length} newer items (since ${new Date(lastSyncTime).toISOString()})`);
        return newerItems as T[];
      }
      
      return serverData as T[];
    } catch {
      console.error(`[SYNC IN] ${endpoint}: Invalid JSON response`);
      return null;
    }
  } catch (error) {
    console.error(`[SYNC IN] ${endpoint}: Error`, error);
    return null;
  }
}

export async function mergeData<T extends { id: string; updatedAt?: number }>(
  local: T[],
  remote: T[]
): Promise<T[]> {
  const merged = new Map<string, T>();
  
  console.log(`[MERGE] Merging ${local.length} local with ${remote.length} remote items`);
  
  local.forEach(item => merged.set(item.id, item));
  
  remote.forEach(item => {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
    } else if ((item.updatedAt || 0) > (existing.updatedAt || 0)) {
      merged.set(item.id, item);
    }
  });
  
  const result = Array.from(merged.values()).filter((item: any) => !item.deleted);
  console.log(`[MERGE] Result: ${result.length} items after merge`);
  return result;
}

async function getLastSyncTime(endpoint: string): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(`${LAST_SYNC_KEY}_${endpoint}`);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

async function setLastSyncTime(endpoint: string, time: number): Promise<void> {
  try {
    await AsyncStorage.setItem(`${LAST_SYNC_KEY}_${endpoint}`, time.toString());
  } catch (error) {
    console.error(`[SYNC] Failed to save last sync time for ${endpoint}:`, error);
  }
}

export async function fullSync<T extends { id: string; updatedAt?: number }>(
  endpoint: string,
  localData: T[],
  direction: 'in' | 'out' | 'both' = 'both'
): Promise<T[]> {
  console.log(`[FULL SYNC] ${endpoint}: Starting full sync (direction: ${direction})...`);
  
  try {
    if (direction === 'out' || direction === 'both') {
      await syncOut(endpoint, localData);
    }
    
    if (direction === 'in' || direction === 'both') {
      const remoteData = await syncIn<T>(endpoint, false);
      if (remoteData) {
        const merged = await mergeData(localData, remoteData);
        await setLastSyncTime(endpoint, Date.now());
        console.log(`[FULL SYNC] ${endpoint}: ✓ Complete`);
        return merged;
      }
    }
    
    console.log(`[FULL SYNC] ${endpoint}: ✓ Complete (using local data)`);
    return localData;
  } catch (error) {
    console.error(`[FULL SYNC] ${endpoint}: Error`, error);
    return localData;
  }
}

export async function backgroundSyncIn<T extends { id: string; updatedAt?: number }>(
  endpoint: string,
  localData: T[]
): Promise<T[]> {
  console.log(`[BACKGROUND SYNC] ${endpoint}: Silent sync...`);
  
  try {
    const remoteData = await syncIn<T>(endpoint, true);
    if (remoteData && remoteData.length > 0) {
      const merged = await mergeData(localData, remoteData);
      await setLastSyncTime(endpoint, Date.now());
      console.log(`[BACKGROUND SYNC] ${endpoint}: ✓ Merged ${remoteData.length} newer items`);
      return merged;
    }
    
    console.log(`[BACKGROUND SYNC] ${endpoint}: No newer data`);
    return localData;
  } catch (error) {
    console.error(`[BACKGROUND SYNC] ${endpoint}: Error`, error);
    return localData;
  }
}

export async function checkAndCleanupOldData(): Promise<void> {
  try {
    const lastCleanup = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
    const lastCleanupTime = lastCleanup ? parseInt(lastCleanup, 10) : 0;
    const now = Date.now();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    
    if (now - lastCleanupTime < threeDaysInMs) {
      console.log('[CLEANUP] Last cleanup was less than 3 days ago, skipping');
      return;
    }
    
    console.log('[CLEANUP] Starting 3-day cleanup...');
    
    const endpoints = [
      'history',
      'pending_requests',
      'activity_logs',
      'stock_checks',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const key = `@${endpoint}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          if (Array.isArray(data)) {
            const cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
            const filtered = data.filter((item: any) => 
              (item.createdAt || item.submittedAt || item.timestamp || 0) > cutoffTime
            );
            
            if (filtered.length < data.length) {
              await AsyncStorage.setItem(key, JSON.stringify(filtered));
              console.log(`[CLEANUP] ${endpoint}: Removed ${data.length - filtered.length} old items`);
            }
          }
        }
      } catch (err) {
        console.error(`[CLEANUP] Error cleaning ${endpoint}:`, err);
      }
    }
    
    await AsyncStorage.setItem(LAST_CLEANUP_KEY, now.toString());
    console.log('[CLEANUP] ✓ Complete');
  } catch (error) {
    console.error('[CLEANUP] Failed:', error);
  }
}
