/**
 * Plays Achieve's backend in the student SSO handshake.
 *
 *   1. The portal page POSTs the student's details to /doubt-solve.
 *   2. This worker calls the Doubts API's initiate endpoint server-to-server,
 *      authenticated by the shared secret, which never reaches the browser.
 *   3. It sends the browser to the one-time `redirect_url` the API returns;
 *      the API consumes that token, sets the session cookie and lands the
 *      student on the Doubts site, signed in.
 *
 * Test harness only: whoever can use this page can sign in as ANY student
 * email, so every request must carry PORTAL_ACCESS_CODE.
 */

type Env = {
  DOUBTS_API_URL: string;
  ACHIEVE_SHARED_SECRET: string;
  PORTAL_ACCESS_CODE: string;
};

/** The Doubts API's success body (integration spec). */
type InitiateSuccess = {
  status: "success";
  user_status: "existing" | "new";
  redirect_url: string;
};

/** Its failure body: INVALID_PAYLOAD, INVALID_AUTH, UNKNOWN_BATCH, ... */
type InitiateError = { status: "error"; error_code: string; message: string };

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/doubt-solve" && request.method === "POST") {
      return startDoubtSolve(request, env);
    }
    // Static files are served before the worker runs, so anything else here
    // is a path that doesn't exist.
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function startDoubtSolve(request: Request, env: Env): Promise<Response> {
  if (!env.ACHIEVE_SHARED_SECRET || !env.PORTAL_ACCESS_CODE) {
    return backToPortal(request, "PORTAL_NOT_CONFIGURED");
  }

  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "").trim();

  if (!(await sameSecret(field("accessCode"), env.PORTAL_ACCESS_CODE))) {
    return backToPortal(request, "WRONG_ACCESS_CODE");
  }

  // Exactly the integration spec's payload. Optional fields are left out
  // rather than sent empty, which the API would reject as malformed.
  const payload: Record<string, string> = {
    Name: field("name"),
    Email: field("email"),
    Batch: field("batch"),
  };
  if (field("phone")) payload.Phone = field("phone");
  if (field("institution")) payload.Institution = field("institution");

  const api = new URL(env.DOUBTS_API_URL);
  let res: Response;
  try {
    res = await fetch(new URL("/api/auth/achieve/sessions/initiate", api), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Achieve-Auth": env.ACHIEVE_SHARED_SECRET,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[portal] Doubts API unreachable", err);
    return backToPortal(request, "API_UNREACHABLE");
  }

  const body = (await res.json().catch(() => null)) as
    | InitiateSuccess
    | InitiateError
    | null;

  if (!res.ok || body?.status !== "success") {
    const code = body?.status === "error" ? body.error_code : `HTTP_${res.status}`;
    console.warn("[portal] initiate refused", res.status, body);
    return backToPortal(request, code);
  }

  // Only ever forward the browser to the API we called.
  const target = new URL(body.redirect_url);
  if (target.origin !== api.origin) {
    console.error("[portal] unexpected redirect origin", target.origin);
    return backToPortal(request, "BAD_REDIRECT");
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: target.toString(),
      // The URL carries a one-time token; keep it out of caches and referrers.
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function backToPortal(request: Request, errorCode: string): Response {
  const url = new URL("/", request.url);
  url.searchParams.set("error", errorCode);
  return Response.redirect(url.toString(), 303);
}

/** Constant-time comparison; hashing first makes the lengths equal. */
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(given)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}
