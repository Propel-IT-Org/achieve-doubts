import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * The API's error vocabulary.
 *
 * HTTP status alone is too coarse for a client to branch on — a 403 is both
 * "you lack the permission" and "you hit your ask quota", which the UI has to
 * tell apart. The `code` carries that distinction; the `error` string is for
 * humans and is safe to display.
 */
export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "QUOTA_EXCEEDED",
  "FOLLOWUP_BLOCKED",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/**
 * Every non-2xx response from this API has this shape — route-level failures,
 * validation failures, `app.notFound` and `app.onError` alike. It is exported
 * to the frontend through `@achieve/doubts-backend/errors` so the client can
 * type its error handling against the same contract.
 */
export type ApiErrorBody = {
  error: string;
  code: ApiErrorCode;
  /** Echoes the `X-Request-Id` header, so a user-reported error is traceable. */
  requestId?: string;
};

/** Fallback mapping for failures that carry a status but no explicit code. */
const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  429: "RATE_LIMITED",
};

export function codeForStatus(status: number): ApiErrorCode {
  return CODE_BY_STATUS[status] ?? "INTERNAL_ERROR";
}

/**
 * An `HTTPException` that also carries an {@link ApiErrorCode}. Throwing this
 * from anywhere (middleware, service, endpoint) lands in `app.onError` and is
 * rendered as a well-formed {@link ApiErrorBody}.
 */
export class AppError extends HTTPException {
  readonly code: ApiErrorCode;

  constructor(
    status: ContentfulStatusCode,
    code: ApiErrorCode,
    message: string,
  ) {
    super(status, { message });
    this.code = code;
  }
}

/**
 * Builds the response body for a thrown error. Deliberately does not leak a
 * non-`HTTPException` message: an unexpected throw can carry a driver error or
 * a connection string, so those become a flat "Internal server error" and the
 * detail goes to the log instead.
 */
export function toErrorBody(err: unknown, requestId?: string): ApiErrorBody {
  if (err instanceof AppError) {
    return { error: err.message, code: err.code, requestId };
  }
  if (err instanceof HTTPException) {
    return {
      error: err.message || "Request failed",
      code: codeForStatus(err.status),
      requestId,
    };
  }
  return { error: "Internal server error", code: "INTERNAL_ERROR", requestId };
}

/**
 * Route-level failure helper. Keeps every handler on the one envelope while
 * preserving Hono's literal status typing, so the RPC client still sees the
 * exact status codes a route can return.
 */
export function fail<S extends ContentfulStatusCode>(
  c: Context,
  status: S,
  code: ApiErrorCode,
  error: string,
) {
  return c.json({ error, code } satisfies ApiErrorBody, status);
}

/**
 * Shared `zValidator` failure hook.
 *
 * Without it, @hono/zod-validator answers with its raw
 * `{ success: false, error: ZodError }` result, which both breaks the envelope
 * and leaks a `ZodSafeParseError<...>` into the generated RPC types. Pass this
 * as the third argument to *every* `zValidator` call.
 */
export function zodErrorHook(
  result: { success: boolean; error?: { issues?: { message: string }[] } },
  c: Context,
) {
  if (!result.success) {
    const message = result.error?.issues?.[0]?.message ?? "Invalid request";
    return c.json(
      { error: message, code: "VALIDATION_FAILED" } satisfies ApiErrorBody,
      400,
    );
  }
}
