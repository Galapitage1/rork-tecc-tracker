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
      headers: () => ({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      fetch: async (url, options) => {
        try {
          console.log('[TRPC CLIENT] Fetching:', url);
          const response = await fetch(url, options);
          console.log('[TRPC CLIENT] Response status:', response.status);
          
          if (!response.ok) {
            const text = await response.text();
            console.error('[TRPC CLIENT] Error response:', text.substring(0, 200));
            throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
          }
          
          return response;
        } catch (error) {
          console.error('[TRPC CLIENT] Fetch error:', error);
          throw error;
        }
      },
    }),
  ],
});