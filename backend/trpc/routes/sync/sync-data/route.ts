import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { readCollection, writeCollection, mergeByTimestamp } from '@/backend/trpc/lib/simple-db';

const baseItemSchema = z.object({
  id: z.string(),
  updatedAt: z.number().optional(),
  deviceId: z.string().optional(),
  deleted: z.boolean().optional(),
});

const syncInputSchema = z.object({
  collection: z.string(),
  data: z.array(z.any()),
  lastSyncTime: z.number().optional(),
});

export const syncDataProcedure = publicProcedure
  .input(syncInputSchema)
  .mutation(async ({ input }) => {
    try {
      const { collection, data, lastSyncTime } = input;
      
      console.log(`[TRPC SYNC] ${collection}: Syncing ${data.length} items`);
      
      const existingData = await readCollection<any>(collection);
      const mergedData = mergeByTimestamp(existingData, data);
      
      await writeCollection(collection, mergedData);
      
      const itemsToReturn = lastSyncTime 
        ? mergedData.filter(item => (item.updatedAt || 0) > lastSyncTime)
        : mergedData;
      
      console.log(`[TRPC SYNC] ${collection}: Returning ${itemsToReturn.length} items (${mergedData.length} total)`);
      
      return {
        data: itemsToReturn,
        totalCount: mergedData.length,
        syncTime: Date.now(),
      };
    } catch (error: any) {
      console.error('[TRPC SYNC ERROR]', error);
      throw new Error(`Failed to sync ${input.collection}: ${error.message}`);
    }
  });
