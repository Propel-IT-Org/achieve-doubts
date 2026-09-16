import { hc } from "hono/client";
// Type-only: the backend package entry is raw TypeScript, so a value import
// would pull Hono/Drizzle/better-auth server code into the browser bundle.
import type { AppType } from "@achieve/doubts-backend";
// Same reason this is type-only: errors.ts exports an AppError class that
// extends Hono's HTTPException, so importing any *value* from it would drag
// server code in. The status fallback below is duplicated deliberately.
import type {
  ApiErrorBody,
  ApiErrorCode,
} from "@achieve/doubts-backend/errors";

/**
 * Fallback for a failure that never reached the API's error handler — a
 * proxy 502, a CORS rejection, an interrupted connection. Mirrors the
 * backend's own status→code mapping in src/lib/errors.ts.
 */
const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  429: "RATE_LIMITED",
};

function codeForStatus(status: number): ApiErrorCode {
  return CODE_BY_STATUS[status] ?? "INTERNAL_ERROR";
}

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
    let code: ApiErrorCode = codeForStatus(res.status);
    let requestId: string | undefined;

    try {
      const body = (await res.json()) as Partial<ApiErrorBody> & {
        message?: string;
      };
      message = body.error ?? body.message ?? message;
      if (body.code) code = body.code;
      requestId = body.requestId;
    } catch {
      // Non-JSON error body — keep the status-based message and code.
    }

    throw new ApiError(message, res.status, code, requestId);
  }
  return (await res.json()) as T;
}

/**
 * Carries the backend's error `code` alongside the status, so callers can
 * branch on *why* a request failed rather than pattern-matching the message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: ApiErrorCode,
    public requestId?: string,
  ) {
    super(message);
  }
  name = "ApiError";
}
