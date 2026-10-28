import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Client errors (403 NOT_ENROLLED, 404, ...) will not change on retry; network/5xx may.
      retry: (failureCount, error) => failureCount < 2 && !(error?.status >= 400 && error?.status < 500),
    },
  },
});
