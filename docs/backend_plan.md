# Achieve Doubts — full backend plan

## Context

`backend/` currently implements a thin slice of a doubt-solving platform: post a doubt, list an
open feed, atomically claim/release a lock, submit a solution, presign an upload. The React
prototype at `docs/acs-doubts-prototype-v2.jsx` (4,061 lines, guest/student/solver/admin-solver +
a separate admin panel) describes a much larger product, and `prompt.txt` adds requirements the
prototype does not show (lock expiry, private asker↔solver thread, public comments, payouts,
ask quotas).

The gap is not incremental. The existing `doubts` table has `title`/`description`/`subject
varchar(64)`, allows many solutions per doubt, and uses a `UNLOCKED|LOCKED|RESOLVED|EXPIRED`
enum. The prototype has no title, uses a subject→book→chapter taxonomy, allows exactly one
solution per question, and runs on `waiting|assigned|answered|satisfied|unsatisfied`. Roughly
80% of the product surface — ratings, follow-up thread, comments, reports, notifications,
profiles, solver dashboard, admin panel, analytics, invoices — has no backend at all.

Decisions taken (from the user):

- **Payments**: students use the platform **free**. No student billing, no gateway, no credits.
  Solvers are paid **manually** based on questions solved; the backend only has to produce the
  invoice figures the admin panel exports.
- **Student auth — we are "the Provider", and the student supplies nothing.** The student clicks
  "Doubt Solve" on Achieve's site and lands on ours already logged in. They never type a
  credential and never fill in a profile: **Achieve is the sole source of student identity and
  data**, passed server-to-server. Students have **no password and no Google login**.
  We follow `docs/Achieve_DoubtSolving_Integration_Spec.pdf` **exactly for payload, response and
  error codes**, and change only the endpoint paths so the flow can live inside a **custom
  `BetterAuthPlugin`**. better-auth keeps ownership of users, sessions and cookies.
- **Solver auth**: **username + password**, accounts created by admins in the admin panel.
- **Admin auth**: **username + password**, restricted to the admin subdomain.
- **Auth stack**: everything through **better-auth** only — one user table, no separate staff
  auth system.
- **Schema**: follow the **frontend prototype**, not the existing tables.
- **Ask quota**: configurable, **default unlimited**.

Outcome: a backend that the prototype could be wired to screen-for-screen, with the lock
lifecycle, moderation and payout reporting the product actually needs.

---

## Part 1 — Bugs in the current code

Fix these regardless of the rest. Several are security-relevant.

### Authorization

1. **`requirePermission` can never fail** — [backend/src/middleware/auth.ts:89](backend/src/middleware/auth.ts#L89).
   better-auth 1.7.4's `userHasPermission` resolves to `{ error, success }`, an always-truthy
   object, so `if (!hasPermission)` is dead. Destructure `.success`.
2. **`requirePermission` assumes a prior middleware** — it reads `c.get("user")`
   ([auth.ts:77](backend/src/middleware/auth.ts#L77)) without fetching a session; mounted alone,
   `user.id` throws a 500. Fetch the session inside it, or require `requireAuth` in front.
3. **`requirePermission` is mounted nowhere.** Authorization in practice is still coarse
   `requireRole` string matching.
4. **Null role silently becomes `student`** — [auth.ts:56](backend/src/middleware/auth.ts#L56)
   `(sessionData.user.role || "student")`. A role-less user gets student powers. Reject instead.
5. **Students and solvers are granted `user: ["list"]`** —
   [permissions.ts:15](backend/src/lib/permissions.ts#L15) and
   [:21](backend/src/lib/permissions.ts#L21). Any logged-in user can call better-auth's
   `/api/auth/admin/list-users` and enumerate accounts. Remove.
6. **Bot defence is inert** — `IS_TURNSTILE_SUSPENDED = true` short-circuits
   [app-check.ts:8](backend/src/middleware/app-check.ts#L8) in every environment, and
   `POST /api/attestation/exchange` mints a valid 1-hour token to any anonymous caller with no
   Turnstile verification. Either wire real Turnstile siteverify or delete the module; keeping a
   disabled guard that also hands out free tokens is worse than neither.

### Lock lifecycle

1. **Lock expiry never actually expires.** `EXPIRED` is in the enum but no code path writes it,
   and there is no sweeper. Expiry is only evaluated lazily inside `claimDoubtAtomic`'s WHERE
   clause ([doubts.service.ts:29-35](backend/src/modules/doubts/doubts.service.ts#L29-L35)),
   while the feed defaults to `status = 'UNLOCKED'`
   ([:109-111](backend/src/modules/doubts/doubts.service.ts#L109-L111)). A stale lock is
   therefore invisible to every solver until someone claims a doubt they cannot see. This
   directly defeats the `prompt.txt` requirement.
2. **`release` has no app-check while `claim` does** —
   [doubts.router.ts:68-71](backend/src/modules/doubts/doubts.router.ts#L68-L71).
3. **Multiple solutions per doubt are physically allowed** — no unique constraint on
   `solutions.doubt_id` ([schema.ts:55-66](backend/src/db/schema.ts#L55-L66)) even though the
   flow marks the doubt resolved on the first insert.

### Feed pagination

 1. **Unvalidated cursor** — [doubts.service.ts:99-107](backend/src/modules/doubts/doubts.service.ts#L99-L107)
    `JSON.parse` of base64 client input with no shape check; a crafted cursor produces
    `new Date(undefined)` → `Invalid Date` into SQL. Validate with a zod schema, sign or reject.
 2. **Unguarded array index** — [doubts.service.ts:144](backend/src/modules/doubts/doubts.service.ts#L144).

### Infrastructure

 1. **No `app.onError` / `app.notFound`** in [index.ts](backend/src/index.ts). Every route
    returns `{ error: string }`, but `requirePermission`'s `HTTPException` renders as Hono's
    default plain-text 403 — two different error contracts. Add both handlers.
 2. **No rate limiting, body-size limit, or request id.** Verified: Hono ships `body-limit`,
    `request-id`, `secure-headers`, `ip-restriction`, `timeout` and `csrf` as built-ins, so those
    are drop-ins. There is **no rate-limiter package installed**, and the Achieve spec requires a
    `429 RATE_LIMITED` response — so that one needs a small in-memory limiter or a new dependency.
 3. **`env.ts` defaults everything**, including `BETTER_AUTH_SECRET`
    ([env.ts:9](backend/src/env.ts#L9)). Production boots silently on the dev secret. Make
    secrets required when `NODE_ENV === "production"`.
 4. **Uploads are fake by default.** `UploadService` falls back to the unauthenticated
    `PUT /api/upload/mock` when S3 env vars are unset — which is the default — so uploads appear
    to succeed and store nothing. There is no content-type allowlist, no size cap, and
    `imageUrl` is accepted from the client with no check that it came from our presign flow.
 5. **Email is non-functional.** `emailAndPassword.enabled: true`
    ([auth.ts:22-24](backend/src/lib/auth.ts#L22-L24)) with no `sendVerificationEmail` or
    `sendResetPassword` callbacks, so verification and password reset silently do nothing.
 6. **`session.updatedAt` has `$onUpdate` but no `defaultNow()`** —
    [auth-schema.ts:28](backend/src/db/auth-schema.ts#L28).
 7. **Dead code**: [src/lib/s3.ts](backend/src/lib/s3.ts) (50 lines, imported by nothing —
    duplicates `UploadService`) and `authContextMiddleware`
    ([auth.ts:17](backend/src/middleware/auth.ts#L17), never mounted).
 8. **No migrations.** `drizzle.config.ts` declares `out: "./drizzle"` but the directory does not
    exist; the workflow is `db:push` only, which is unsafe past development.
 9. **Tests**: `test/doubts.test.ts` fails (`client.query is not a function` — the insert path is
    unstubbed) and has a stray `console.log` at line 32. `tsconfig.json` excludes `test/`, so
    typecheck never covers it, and there is no `test` script.
10. **FeedHub type lie** — the DI scope input named `ws` is the Bun `Server`, typed as
    `ServerWebSocket`, hidden by `as never` ([index.ts:53](backend/src/index.ts#L53)). Every
    method swallows errors in empty `catch` blocks, and `WSClientData` is declared but never
    populated, so per-user delivery is impossible.

---

## Part 2 — What the prototype has that the backend does not

Everything below is absent today. This is the feature gap, by role.

**Taxonomy & discovery** — subjects → books → chapters (5 subjects, 9 books, ~90 chapters, each
with `en`/`bn` names); cascading subject/book/chapter filters; status filter; full-text search on
question body; "only my questions".

**Question lifecycle** — `matchedAfter` (seconds from ask to lock); solver-assigned notification;
one solution per question; solution is **not editable**, only deletable (by its solver, or any
admin solver), which returns the question to `assigned` and clears rating + thread; asker rating
`satisfied`/`unsatisfied`, changeable later; lock expiry (from `prompt.txt`, not in prototype).

**Attachments** — voice notes on solutions, follow-ups and comments; image on question, solution,
follow-up and comment. Backend has one nullable `imageUrl` per doubt and no audio at all.

**Private follow-up thread** — asker + assigned solver only, readable by other logged-in users,
opens only after a solution exists, cleared on unlock or solution deletion.

**Public comments** — any logged-in *student* may comment (solvers explicitly may not); admin
solvers soft-delete; new comments notify both the asker and the assigned solver.

**The `FOLLOWUP_BLOCK` rule** — a solver with **3 or more** pending follow-ups cannot lock new
questions. A follow-up is pending when a solution exists, the question is not `satisfied`, and
the last non-deleted thread message is from the asker. The prototype states this must be enforced
by the lock endpoint.

**Admin-solver powers (main site)** — override another solver's lock; soft-delete any question,
solution, follow-up or comment; the prototype asks for an audit log.

**Reports** — student reports a solved question (`wrong | incomplete | behaviour | other` +
details ≥10 chars); reporter sees only their own reports and status; staff resolve with
who/when recorded.

**Notifications** — types `assigned | released | solved | comment | followup | override`; unread
badge; filter by type and read state; opening marks read.

**Profiles** — public student profile (questions asked, satisfaction, answered, avg wait for a
solver, recent questions) and public solver profile (solved, satisfaction, avg response, recently
solved). Both explicitly exclude contact details and the admin flag.

**Solver dashboard** — solved, satisfaction, questions locked, unlock rate, avg response, open
count, "locked by you", pending follow-ups list, recently solved.

**Admin panel** — student search (name/college/district/email) + record drawer +
deactivate/reactivate (must revoke sessions); solver list with solved/satisfaction/pending;
create solver (unique email + phone, ≥8-char password, welcome email); deactivate solver;
analytics for any date range with subject/solver filters (per-subject bars, satisfaction pie,
daily/weekly trend, avg response, avg match time, best/worst rankings with a minimum-answered
threshold, most-answered/highest-satisfaction/fastest highlights); invoice table + Excel export
figures.

**Homepage aggregates** — total solved, median match time, median answer time, satisfaction rate,
solvers online.

**Guest gating** — guests browse the question list and read question text and comments, but the
solution and follow-up thread are login-gated. Today every read endpoint is fully public.

---

## Part 3 — Target schema

Replace `doubts`/`solutions` entirely. Rewrite `backend/src/db/schema.ts`, split per domain, and
switch to generated migrations (`db:generate` + a new `db:migrate`), retiring `db:push`.

**Enums**

```
question_status  waiting | assigned | answered | satisfied | unsatisfied
report_reason    wrong | incomplete | behaviour | other
report_status    open | resolved
notif_type       assigned | released | solved | comment | followup | override
thread_author    asker | solver
lock_action      lock | unlock | override | expire
```

**Taxonomy** (seeded from `SUBJECTS` at `docs/acs-doubts-prototype-v2.jsx:544-592`)

- `subjects(id varchar pk, name_en, name_bn, sort)`
- `books(id varchar pk, subject_id fk, name_en, name_bn, sort)`
- `chapters(id serial pk, book_id fk, number int, name_en, name_bn, unique(book_id, number))`

**Identity** — keep better-auth's `user`/`session`/`account`/`verification` untouched (the
`username` plugin adds `username` / `display_username` to `user`); add:

- `student_profiles(user_id pk fk, hsc_year, college, district, phone, institution,
  batch_id fk null, achieve_key unique)` — `achieve_key` is the agreed unique mapping key from
  the Achieve payload and is what guarantees "exactly one Provider user across sessions".
- `solver_profiles(user_id pk fk, phone unique, institution, dept, batch, is_admin_solver bool)`
- `batches(id varchar pk, label, active bool)` — e.g. `hscfrb26`. Required because the spec
  defines a `404 UNKNOWN_BATCH` error, so the batch must be validated against a real registry.
- `achieve_sso_tokens(token_hash pk, user_id fk, batch_id, expires_at, consumed_at null,
  created_ip)` — the one-time redirect tokens, stored as **SHA-256 hashes**, never in plain text.
  A dedicated table rather than better-auth's `verification`, because consumption must be a
  single atomic compare-and-consume statement (which the adapter API cannot express) and because
  `verification` is indexed on `identifier`, not `value` ([auth-schema.ts:78](backend/src/db/auth-schema.ts#L78)).
  See Part 4.

`user.role` stays better-auth's field: `student | solver | staff`, with `is_admin_solver` on the
solver profile carrying the prototype's `admin: true` flag. `active` maps to better-auth's
`banned` so deactivation revokes sessions through the admin plugin rather than a parallel flag.

**Core**

- `questions(id serial, asker_id fk, subject_id, book_id, chapter_id, text, photo_url,
  status, solver_id fk null, locked_at, lock_expires_at, matched_after_sec,
  asked_at, answered_at, rated_at, deleted_at, deleted_by)`
- `solutions(id serial, question_id fk **unique**, solver_id fk, text, image_url, audio_url,
  audio_seconds, created_at, deleted_at, deleted_by)` — the unique constraint is what enforces
  "one solution per question" (bug 9).
- `thread_messages(id, question_id fk, author_id fk, author_side thread_author, text, image_url,
  audio_url, audio_seconds, created_at, deleted_at, deleted_by)`
- `comments(id, question_id fk, author_id fk, text, image_url, audio_url, audio_seconds,
  created_at, deleted_at, deleted_by)`
- `reports(id, question_id fk, reporter_id fk, reason, text, status, created_at, resolved_at,
  resolved_by fk)`
- `notifications(id, user_id fk, type, question_id fk, actor_id fk, created_at, read_at)`
- `lock_events(id, question_id fk, solver_id fk, action lock_action, at)` — source of truth for
  the dashboard's "questions locked" and "unlock rate", and an audit trail. Avoids the
  denormalized counters that drifted in the legacy Appwrite data.
- `audit_log(id, actor_id, action, entity_type, entity_id, meta jsonb, at)` — every admin delete,
  override, deactivation and report resolution.
- `ask_quota_policies(id, scope, max_per_day int null, max_per_month int null, active bool)` —
  seeded with one row, both limits `NULL` = unlimited.
- `payout_periods(id, from_date, to_date, status draft|paid, generated_at, paid_at, note)` and
  `payout_lines(id, period_id fk, solver_id fk, answered, satisfied, unsatisfied, unrated,
  avg_resp_min, rate, amount)` — the manual-payout record. Figures are computed in SQL; the rows
  are the immutable snapshot the admin exported and paid against.

**Indexes** — `(status, asked_at desc, id desc)` for the keyset feed; `(subject_id, book_id,
chapter_id)`; `(asker_id)`; `(solver_id, status)`; `(user_id, read_at)` on notifications;
`(status, created_at)` on reports; a GIN trigram index on `questions.text` for search.

Deliberately **not** copied from the legacy Appwrite schema: `-1` sentinels, duplicated
`satisfied` on both sides, `satisfied` + `notSatisfied` as two independent nullables, and
denormalized `lockedByName`/`checkerName`. Worth borrowing later: `transcription` (OCR/LaTeX of
the image) and the similarity/dedupe pipeline — leave a nullable `transcription` column now,
implement nothing.

---

## Part 4 — Auth

Single better-auth instance. Extend `backend/src/lib/auth.ts` and `backend/src/lib/permissions.ts`.

**Roles** via the existing `createAccessControl` setup — replace the current three with
`student`, `solver`, `adminSolver`, `staff`, and drop `user: ["list"]` from the non-staff roles
(bug 5). Add statements for the new entities: `comment`, `thread`, `report`, `rating`, `payout`,
`analytics`. Then actually **mount `requirePermission`** on routes once fixed (bugs 1–3), keeping
`requireRole` only for the coarse student/solver split.

**Solvers and staff — username + password.** Add better-auth's **`username` plugin** (verified
present in 1.7.4 and exported as `better-auth/plugins/username`; gives `POST /sign-in/username`
and `auth.api.signInUsername`, with `minUsernameLength` / `usernameValidator`). Set
`disableSignUp: true` so the public cannot self-register into these roles — solver accounts are
created only by admins (`POST /admin/solvers`), matching the prototype. Keep email on the record
for the welcome mail and password reset, and add the missing `sendVerificationEmail` /
`sendResetPassword` callbacks (bug 16).

**Admin subdomain isolation.** Staff sign-in is served only from the admin origin: restrict the
staff sign-in route and all `/admin/*` routes by `Origin`/`Host`, add the admin domain to
`trustedOrigins`, and scope the session cookie to it. One better-auth instance, as requested —
the isolation is an origin check, not a second auth system.

**Students — a custom `BetterAuthPlugin` implementing the Achieve handshake**, in
`backend/src/lib/achieve-sso-plugin.ts`. The doc describes a bespoke server-to-server token
exchange, not OAuth2/OIDC, so no off-the-shelf plugin fits: `generic-oauth` is an OAuth *client*
("registers any OAuth/OIDC provider as a first-class social provider") and needs Achieve to
expose authorize/token/userinfo endpoints, which the doc does not define; `@better-auth/sso` is a
**separate package** (v1.7.5, not installed, peer-deps `better-auth ^1.7.5`) aimed at SP-initiated
OIDC/SAML. A custom plugin keeps the doc's contract while better-auth still owns users, sessions
and cookies.

**Endpoint paths.** Plugin endpoints mount under better-auth's `basePath`, so a path declared as
`/achieve/sessions/initiate` is served at **`/api/auth/achieve/sessions/initiate`**. Declaring
`/api/v1/sessions/initiate` inside a plugin would resolve to
`/api/auth/api/v1/sessions/initiate` — give Achieve the real URL.

Verified against the installed 1.7.4:

- `createAuthEndpoint` — exported from `better-auth/api` (re-exported from `@better-auth/core/api`).
- Plugin `schema?: { [model]?: { fields: Record<string, DBFieldAttribute> } }`, so the plugin can
  declare extra `user` fields.
- `ctx.context.internalAdapter` with `createSession(userId, dontRememberMe?, override?,
  overrideAll?, storageOptions?): Promise<Session>` and `createUser(user, source)`.
- `setSessionCookie(ctx, { session, user }, dontRememberMe?, overrides?)`.
- `ctx.json(body, { status })` and `ctx.redirect(url)`; `ctx.body` / `ctx.query` are
  `InferBody` / `InferQuery` of the endpoint's **declared zod schemas**.

Corrections to the reference sketch, each verified against those typings:

1. **`createSession(userId, ctx)` is wrong.** The second parameter is `dontRememberMe?: boolean`,
   not the request context; passing `ctx` is truthy and silently yields a non-persistent session.
   Call `createSession(user.id)`.
2. **Set the cookie via `setSessionCookie(ctx, { session, user })`**, not a manual
   `ctx.setSignedCookie(...)` — whose real signature is `(key, value, secret, options?)`, so the
   sketch's call has the wrong arity too. `createSession` returns only a `Session`, so pass the
   user object from the upsert.
3. **Declare zod `body` and `query` schemas** in the endpoint options. Without them `ctx.body`
   and `ctx.query` are neither typed nor validated — and the schema is what yields
   `INVALID_PAYLOAD` for free.
4. **The single-use check is racy.** `findOne` → `delete` → create-session lets two concurrent
   requests both pass `findOne` before either deletes, so the "second tab fails" claim does not
   hold. Consume in **one** statement: a drizzle
   `DELETE … WHERE token_hash = $1 AND expires_at > now() RETURNING user_id` (or
   `UPDATE … SET consumed_at = now() WHERE consumed_at IS NULL … RETURNING`). better-auth's
   adapter cannot express compare-and-consume, so use drizzle directly here.
5. **Store a hash, not the token.** The sketch persists the raw token, so anyone who can read the
   table can mint sessions. Store and look up `sha256(token)`.
6. **Use an indexed column.** `verification` is indexed on `identifier`, not `value`, so a lookup
   by `value` is a full scan — hence the dedicated `achieve_sso_tokens` table in Part 3.
7. **Set `role: "student"` explicitly** on creation. The sketch omits it, leaving `role` null —
   precisely the latent hole described in bug 4.
8. **Compare the shared secret in constant time** (`crypto.timingSafeEqual` over equal-length
   buffers), not `!==`.
9. **Prefer `internalAdapter.createUser`** to a raw `adapter.create({ model: "user" })`, so
   better-auth's provisioning seam and `databaseHooks` still run.
10. **Upsert on every handshake**, not only on first contact, so profile changes propagate; the
    sketch only ever creates.
11. **32 random bytes**, not 16 — the doc's 128 bits is a floor and 32 costs nothing.
12. Add the **IP allowlist** (`403 IP_NOT_ALLOWED`, via Hono's `ip-restriction`) and
    **rate limiting** (`429 RATE_LIMITED`); the sketch implements neither although the doc
    defines both.

Payload and response stay exactly as documented: request
`{ Name, Email, Phone, Institution, Batch }`; success
`{ status: "success", user_status: "existing" | "new", redirect_url }`; failures carry
`INVALID_PAYLOAD` 400, `INVALID_AUTH` 401, `IP_NOT_ALLOWED` 403, `UNKNOWN_BATCH` 404,
`RATE_LIMITED` 429, `INTERNAL_ERROR` 500. Token TTL **90 seconds**, single-use, bound to one user.
`Batch` is validated against the `batches` table, and `student_profiles` is upserted from the
payload on every call.

**Field gap to settle with Achieve.** The prototype's student profile shows **HSC year, college
and district**, which the documented payload does not carry. Either Achieve adds them or those
fields stay null and the profile screens degrade. Resolve before building the profile endpoints.

**Considered and not used:** the `one-time-token` plugin — its `/one-time-token/generate` is a
session-gated GET, so it presumes an already-authenticated user, whereas this handshake must work
for a student who does not exist yet.

Students therefore have no credential path at all — no password, no social provider. Do **not**
enable Google or any other social login.

**Deactivation** — use the admin plugin's ban + session revocation so a deactivated student or
solver is signed out immediately, matching the prototype's stated behaviour.

**Deactivation** — use the admin plugin's ban + session revocation so a deactivated student or
solver is signed out immediately, matching the prototype's stated behaviour.

---

## Part 5 — Endpoints

Modules under `backend/src/modules/`, each `*.router.ts` / `*.service.ts` / `*.schema.ts`,
registered in [di.ts](backend/src/lib/di.ts) and mounted in [index.ts](backend/src/index.ts).
`G` = guest-readable, `S` = student, `V` = solver, `A` = admin solver, `T` = staff.

**achieve** (server-to-server; shared secret + IP allowlist, never called by a browser)

```
POST   /api/auth/achieve/sessions/initiate  Achieve backend only; upsert user + mint token
GET    /api/auth/achieve/sso?token=…        consume token, set session cookie, 302 to landing
GET    /admin/batches, POST /admin/batches, POST /admin/batches/:id/active   T
```

**taxonomy** — `GET /subjects` (G, nested books+chapters, cacheable).

**questions**

```
GET    /questions                 G   subject, book, chapter, status, q, mine, cursor, limit
GET    /questions/:id             G   solution+thread omitted for guests
POST   /questions                 S   quota-checked; broadcasts; returns created
GET    /questions/open/count      V
POST   /questions/:id/lock        V   atomic; enforces FOLLOWUP_BLOCK; sets matched_after_sec
POST   /questions/:id/unlock      V   holder only, only before a solution; clears thread
POST   /questions/:id/override    A   takes over an assigned lock; notifies previous solver
DELETE /questions/:id             A   soft delete + audit
GET    /questions/feed/ws         V   live feed (existing, to be extended)
```

**solutions**

```
POST   /questions/:id/solution        V   assigned solver only, one per question → answered
DELETE /questions/:id/solution        V/A own solver or admin; → assigned, clears rating+thread
POST   /questions/:id/rating          S   asker only, satisfied|unsatisfied, changeable
```

**thread** (asker + assigned solver only, after a solution exists)

```
GET    /questions/:id/thread          S/V  logged-in read; post rights enforced separately
POST   /questions/:id/thread          S/V
DELETE /questions/:id/thread/:msgId   A
```

**comments** (students post; solvers explicitly cannot)

```
GET    /questions/:id/comments        G
POST   /questions/:id/comments        S
DELETE /questions/:id/comments/:cid   A
```

**reports**

```
POST   /questions/:id/reports     S   reason + text (≥10 chars)
GET    /me/reports                S   own only
GET    /admin/reports             T   status + reason filter
POST   /admin/reports/:id/resolve T   records resolver + timestamp
```

**notifications**

```
GET    /me/notifications          S/V  type + read filters, paginated
GET    /me/notifications/unread   S/V  badge count
POST   /me/notifications/:id/read S/V
POST   /me/notifications/read-all S/V
```

**profiles & dashboard**

```
GET    /students/:id              G   public only — no email, phone
GET    /solvers/:id               G   public only — no email, phone, admin flag
GET    /me/solver/dashboard       V   metrics + locked + pending follow-ups + recent
GET    /stats/home                G   solved, median match, median answer, satisfaction, online
```

**admin** (staff)

```
GET    /admin/students            T   search name/college/district/email
GET    /admin/students/:id        T
POST   /admin/students/:id/active T   ban/unban → revokes sessions
GET    /admin/solvers             T
POST   /admin/solvers             T   unique email+phone, ≥8-char password, welcome email
POST   /admin/solvers/:id/active  T
POST   /admin/solvers/:id/admin   T   toggle is_admin_solver
GET    /admin/analytics           T   range + subject + solver filters, SQL aggregation
GET    /admin/analytics/rankings  T   best/worst/fastest, minAnswered threshold
GET    /admin/payouts             T   computed invoice rows for a range
POST   /admin/payouts             T   snapshot a period
POST   /admin/payouts/:id/paid    T   mark manually paid
GET    /admin/quota, PUT /admin/quota  T
```

**uploads** — replace the presign stub: content-type allowlist (image/jpeg, image/png, image/webp,
audio/webm, audio/mp4), size cap, and a returned key the create endpoints validate against, so a
client cannot attach an arbitrary URL (bug 15).

**health** — `GET /healthz`, `GET /readyz`.

All analytics endpoints aggregate **in SQL** over the date range and filters — the prototype's
`Dev` notes call this out explicitly, and doing it in JS will not survive real volume.

---

## Part 6 — Lock lifecycle

The single most important correctness area; get it right before anything else.

- **Lock** stays one atomic `UPDATE … RETURNING` (the existing `claimDoubtAtomic` shape is
  correct) with `WHERE id = ? AND status = 'waiting'`, plus a *reclaim* branch for expired locks.
  First writer wins; a `null` result is a 409 naming the current holder.
- **`lock_expires_at`** is written on lock (`now + LOCK_TTL`, config-driven, default 15 min).
- **A sweeper** — `backend/src/jobs/lock-sweeper.ts`, an interval task — flips expired
  `assigned`-without-solution questions back to `waiting`, writes a `lock_events` row with
  `expire`, and broadcasts. This is what bug 7 is missing; without it, expired locks stay hidden
  from the feed.
- **Unlock** is holder-only and only before a solution exists; it clears `solver_id`,
  `locked_at`, `matched_after_sec` and the thread, exactly as the prototype does.
- **Override** (admin solver) reassigns without clearing, notifies the displaced solver, and
  writes `lock_events` + `audit_log`.
- **`FOLLOWUP_BLOCK = 3`** is checked inside the lock transaction, not in the handler, so it
  cannot be raced.
- Every transition writes `lock_events` and broadcasts on the feed.

Concurrency here needs a **real Postgres test**, not the mock-only `test/locking.test.ts` that
exists now — two concurrent claims, exactly one winner.

---

## Part 7 — Realtime & notifications

Extend [ws/hub.ts](backend/src/ws/hub.ts) from one global topic to three: `feed` (question
created/locked/unlocked/released/resolved), `user:{id}` (notifications), `question:{id}` (thread,
comments, rating). Populate `WSClientData` at upgrade so per-user delivery works, fix the
`Server`-typed-as-`ServerWebSocket` lie and the `as never` cast (bug 21), and stop swallowing
errors silently.

Notifications are written **in the same transaction** as the event that causes them, then
published. Prototype triggers: lock → asker (`assigned`); unlock → asker (`released`); solution →
asker (`solved`); comment → asker **and** assigned solver (`comment`); follow-up → solver
(`followup`); override → displaced solver (`override`).

Note for later: this is single-process. Multi-instance fan-out needs Redis pub/sub behind the
same `FeedHub` interface — worth designing the interface for now, not implementing.

---

## Part 8 — Order of work

1. **Foundation** — `onError`/`notFound`, rate limit, body cap, request id, strict prod env,
   delete `lib/s3.ts` + `authContextMiddleware`, add `test` script, include `test/` in typecheck,
   fix the failing test. *(bugs 12–14, 18, 20)*
2. **Schema + migrations** — new tables, generated migrations, taxonomy seed, `db:migrate`.
3. **Auth** — roles, permission statements, fix and mount `requirePermission`, the `username`
   plugin for solver/admin login, admin-subdomain origin restriction, email callbacks,
   ban-based deactivation. *(bugs 1–5, 16)*
3b. **Achieve handshake** — the custom `BetterAuthPlugin`: `batches` + `achieve_sso_tokens`, the
   initiate endpoint with constant-time secret check, IP allowlist and rate limit, atomic token
   consumption, session establishment, profile upsert and the documented error-code set. Ships
   with the auth phase so students can actually log in.
4. **Question lifecycle** — CRUD, taxonomy filters, search, keyset feed with a validated cursor,
   lock/unlock/override, sweeper, quota. *(bugs 7–11)*
5. **Interaction** — solution + delete, rating, thread, comments, uploads with validation,
   notifications, realtime. *(bug 15)*
6. **Reporting** — reports + resolution, profiles, solver dashboard, home stats, admin students /
   solvers / analytics / rankings / payouts, audit log.

Each phase ends green: `bun run typecheck` and `bun test` both clean.

---

## Verification

- `cd backend && bun run typecheck` — clean, now including `test/`.
- `bun test` — currently 37 pass / **1 fail**; must be green, with new coverage for: the
  permission matrix per role (the gap that let bug 1 ship), concurrent lock claims against real
  Postgres, lock expiry + sweeper, `FOLLOWUP_BLOCK`, one-solution-per-question, thread and
  comment posting rights, cursor tampering, and quota enforcement.
- **Integration against real Postgres** — add a docker-compose Postgres and run migrations in
  CI. The current suite never touches a real database, so no SQL in the codebase is proven to
  compile against the schema.
- **Manual end-to-end** with `bun run dev`: seed taxonomy → create a student via the stub portal
  client and two solvers via staff → student asks → both solvers hit `/lock` concurrently, exactly
  one wins → loser sees 409 → winner submits a solution → asker rates `unsatisfied` → asker posts
  a follow-up → third student comments → solver's pending-follow-up count reaches 3 and further
  locking is refused → admin solver overrides a lock and soft-deletes a comment → student files a
  report → staff resolves it → analytics and payout figures for the range reflect all of it.
- **Achieve handshake** — the security properties are the point, so test them directly: a wrong
  or missing shared secret returns `401 INVALID_AUTH`; a disallowed source IP returns
  `403 IP_NOT_ALLOWED`; an unknown batch returns `404 UNKNOWN_BATCH`; a malformed payload returns
  `400 INVALID_PAYLOAD`. Then: the same student handshaking twice maps to **one** user with
  `user_status` flipping `new` → `existing`; a changed `Name` or `Institution` on the second
  handshake is reflected in `student_profiles`; a token replayed twice succeeds exactly once
  — **assert this concurrently, not sequentially**, since that is the race the atomic consume
  exists to close; a token used after 90s fails; the token is never stored in plain text; the
  created user has `role = "student"` rather than null; and consuming a valid token yields a
  **persistent** session cookie (regression test for the `dontRememberMe` foot-gun) accepted as
  role `student`, with no password ever set on the account.
- **WebSocket** — connect two solver clients; confirm a lock by one removes the question from the
  other's feed live, and that a notification reaches only its target user.
- **Lock expiry** — set `LOCK_TTL` to 10s, lock a question, wait, confirm the sweeper returns it
  to `waiting`, that it reappears in the feed, and that a different solver can claim it.
