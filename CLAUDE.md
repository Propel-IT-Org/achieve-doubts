# Achieve Doubts — working rules

Bun workspace. `backend/` (Hono + Drizzle + better-auth on Bun) and
`frontend/` (React Router v8 SPA + SWR + Tailwind v4).

## Commit scope

Only ever stage `frontend/`, `backend/`, or root `package.json`-related
files. **Never commit `docs/`**, `bun.lock` churn from unrelated tooling, or
build output (`frontend/build/`, `.react-router/` — both gitignored).
Stage explicitly (`git add frontend/ backend/`), never `git add -A`.

Commit after each meaningful part, not at the end.

---

## Frontend

### Visual fidelity is the priority

`docs/acs-doubts-prototype-v2.jsx` is the design source of truth and the
target is a ~99% match. It ships a **bespoke CSS design system**, not a
utility-class one:

- Every rule is scoped under `.acs` and driven by CSS custom properties
  (`--navy`, `--gold`, `--line`, `--display`, `--body`, ...).
- Fonts are Gloock (display) + Hanken Grotesk (body) + Noto Sans/Serif
  Bengali, loaded from Google Fonts.
- Mobile-first with breakpoints at 420/480/520/560/640/700/780/900/980/1000px
  and a fixed bottom nav below 900px.

**Port that stylesheet verbatim into `app/styles/acs.css`.** Do not
re-implement it in Tailwind utilities, and do not install shadcn/Radix to
replace it — component libraries bring their own visual system and would
actively fight the match. Tailwind stays available but the prototype's
classes (`.btn`, `.panel`, `.qc`, `.pill`, ...) are what the markup uses.

Reach for a Radix primitive only if a specific a11y behaviour genuinely
needs it (focus trapping, etc.) — the prototype already hand-rolls its
dropdown/drawer/dialog behaviour, so this should be rare. If you do, say why.

Class names, DOM structure, `aria-*` attributes and copy strings should
match the prototype. The `<Dev>` "Backend:" annotation blocks are prototype
scaffolding — drop them.

### Data layer

- **Hono RPC** for every backend call. One shared client in `app/lib/api.ts`.
  `AppType` **must** be imported as `import type` — the backend's package
  entry is raw TS (`./src/index.ts`), so a value import would drag Hono,
  Drizzle and better-auth server code into the browser bundle.
- **SWR with suspense**, primed from `clientLoader` via `preload(key, fetcher)`
  so navigation starts the request before the component renders. Keys are
  arrays (`["questions", filters]`).
- **`useSWRMutation`** for every write. After a successful write, revalidate
  the affected keys — don't hand-roll optimistic cache edits unless the
  prototype's UX depends on it.
- **react-hook-form + zod** for every form, via `zodResolver`.
- Route modules use `clientLoader` (SPA mode: `ssr: false`), never `loader`.

### Shared validation

Zod schemas that both sides need are re-exported from the backend package
(`@achieve/doubts-backend/schemas`) rather than duplicated. Add a new export
entry to `backend/package.json` when a new schema group is needed. Only put
genuinely shared *request* schemas there — keep DB/internal schemas private.

### Auth on the client

`app/lib/auth.ts` holds the better-auth React client (admin + username
plugins, wired to the backend's `ac`/`roles`). Use it for session, sign-in,
sign-out and permission checks; use RPC for everything else.

Roles are `student | solver | adminSolver | staff`. There is no
"isAdminSolver" flag — admin-solver is its own role.

---

## Backend

- Routers are chained `new Hono<AppEnv>()...` exports; services take `db: DB`
  via constructor injection and are registered in `src/lib/di.ts`.
- Authorization is `requirePermission({ entity: ["verb"] })` against
  `src/lib/permissions.ts`. Chain `requireAuth` first when the handler needs
  `c.var.user`. Use `optionalAuth` when the *response shape* differs for
  guests. Don't add bespoke role-checking middleware.
- Every error response is `{ error: string }`. The Achieve SSO endpoints are
  the one exception — they follow the integration spec's
  `{ status, error_code, message }` contract.
- **Never hand-edit `src/db/schema/auth.ts`.** It is generated:
  `bun run auth:generate`. Tables the SSO plugin owns are declared in its
  `schema` option and reach the DB through that generator.
- After any schema change run `bun run db:generate`.
- Validation with zod via `@hono/zod-validator`; prefer zod v4 top-level
  helpers (`z.url()`, `z.email()`), not the deprecated chained forms.

---

## Verification

Before each commit:

```
cd backend  && bun run typecheck && bun test
cd frontend && bun run typecheck
```

Both must be clean. State test counts honestly in the commit message, and
name what is *not* covered — there is still no Postgres-backed integration
suite, so DB-touching paths are unproven beyond typecheck and mocks.
