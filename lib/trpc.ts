import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { getApiBaseUrl } from "@/utils/apiBaseUrl";

export const trpc = createTRPCReact<AppRouter>();

const apiBaseUrl = getApiBaseUrl();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${apiBaseUrl}/api/trpc`,
      transformer: superjson,
    }),
  ],
});