import { hc } from "hono/client";
// Type-only: the backend package entry is raw TypeScript, so a value import
// would pull Hono/Drizzle/better-auth server code into the browser bundle.
import type { AppType } from "@achieve/doubts-backend";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Typed RPC client. `credentials: "include"` so better-auth's session cookie
 * rides along — the backend's CORS config already allows this origin with
 * credentials.
 */
export const api = hc<AppType>(API_URL, {
  init: { credentials: "include" },
});

/**
 * Hono's client returns a union of every declared response for a route
 * (including validation-failure shapes), so reading `.json()` blind gives a
 * union that rarely narrows usefully. Every fetcher goes through this: it
 * throws on a non-2xx with the backend's `{ error }` message, leaving the
 * happy-path type to the caller.
 */
/**
 * The minimum surface `unwrap` touches. Declared structurally because Hono's
 * `ClientResponse` is *not* assignable to the DOM `Response` (it additionally
 * requires `textStream`), so typing the parameter as `Response` rejects every
 * RPC call site.
 */
type JsonResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export async function unwrap<T>(res: JsonResponse): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
  name = "ApiError";
}
