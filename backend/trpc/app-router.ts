import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { sendEmailProcedure } from "./routes/campaigns/send-email/route";
import { testEmailProcedure } from "./routes/campaigns/test-email/route";
import { syncDataProcedure } from "./routes/sync/sync-data/route";
import { getDataProcedure } from "./routes/sync/get-data/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  campaigns: createTRPCRouter({
    sendEmail: sendEmailProcedure,
    testEmail: testEmailProcedure,
  }),
  sync: createTRPCRouter({
    syncData: syncDataProcedure,
    getData: getDataProcedure,
  }),
});

export type AppRouter = typeof appRouter;