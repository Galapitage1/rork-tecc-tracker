import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { readCollection } from '@/backend/trpc/lib/simple-db';

const getInputSchema = z.object({
  collection: z.string(),
  lastSyncTime: z.number().optional(),
});

export const getDataProcedure = publicProcedure
  .input(getInputSchema)
  .query(async ({ input }) => {
    try {
      const { collection, lastSyncTime } = input;
      
      console.log(`[TRPC GET] ${collection}: Fetching data (lastSyncTime: ${lastSyncTime})`);
      
      const data = await readCollection<any>(collection);
      
      const itemsToReturn = lastSyncTime 
        ? data.filter(item => (item.updatedAt || 0) > lastSyncTime)
        : data;
      
      console.log(`[TRPC GET] ${collection}: Returning ${itemsToReturn.length} items (${data.length} total)`);
      
      return {
        data: itemsToReturn,
        totalCount: data.length,
        syncTime: Date.now(),
      };
    } catch (error: any) {
      console.error('[TRPC GET ERROR]', error);
      throw new Error(`Failed to get ${input.collection}: ${error.message}`);
    }
  });
