import type { SWRConfiguration } from "swr";
import { toast } from "sonner";
import { ApiError } from "./api";

/** Retrying these can't change the answer: bad input, no access, gone. */
const FINAL_STATUSES = new Set([400, 401, 403, 404, 409, 413, 422]);

export function isRetryable(error: unknown): boolean {
  return !(error instanceof ApiError && FINAL_STATUSES.has(error.status));
}

const MAX_RETRIES = 3;

/**
 * Global error handling (https://swr.vercel.app/docs/error-handling).
 *
 * Where an error is SHOWN is decided by the component: suspense reads throw
 * to the nearest <AsyncBoundary>, and non-suspense reads (the question list,
 * the unread badge) render their own `error`. This config decides the rest:
 * what is retried, and what is reported once for the whole app.
 */
export const swrErrorConfig = {
  onErrorRetry(error, _key, _config, revalidate, { retryCount }) {
    if (!isRetryable(error)) return;
    if (retryCount >= MAX_RETRIES) return;

    // Exponential backoff with jitter; a rate-limited request waits longer.
    const base = error instanceof ApiError && error.status === 429 ? 10_000 : 1_000;
    const delay = base * 2 ** retryCount * (0.5 + Math.random());
    setTimeout(() => revalidate({ retryCount }), delay);
  },

  onError(error, key) {
    if (error instanceof ApiError) {
      // A session that ends mid-visit makes every signed-in read fail at
      // once; one message is enough. The toast id collapses the rest.
      if (error.status === 401) {
        toast.error("Your session has ended. Log in again to continue.", {
          id: "session-ended",
        });
        return;
      }
      // Expected outcomes the UI already explains.
      if (error.status < 500) return;
    }

    // Server faults and network failures: keep a trace for bug reports. The
    // request id matches the backend's `[unhandled] requestId=` log line.
    const requestId = error instanceof ApiError ? error.requestId : undefined;
    console.error(`[swr] ${JSON.stringify(key)} failed`, { requestId, error });
  },
} satisfies SWRConfiguration;
