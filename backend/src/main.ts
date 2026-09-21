/**
 * Production entrypoint, and the only file the release image runs:
 *
 *   bun dist/main.js            serve (default)
 *   bun dist/main.js migrate    apply drizzle/ migrations, then exit
 *   bun dist/main.js seed       load the subject/book/chapter taxonomy
 *   STAFF_PASSWORD=… bun dist/main.js create-staff <email> <name>
 *                               create an admin-panel (staff) account
 *   bun dist/main.js seed-solvers <accounts.json | ->
 *                               create solver accounts from a JSON list
 *                               ("-" reads it from stdin)
 *
 * Subcommands load their code with dynamic import(), so `migrate` never
 * builds the app or starts the lock sweeper against a schema that may not
 * exist yet. `bun build` inlines those imports, so the output is one file.
 *
 * `bun run dev` still runs src/index.ts directly (hot reload via Bun's
 * default-export auto-serve). This file adds what production needs on top:
 * draining on SIGTERM.
 */
import { env } from "./env";

const command = process.argv[2] ?? "serve";

switch (command) {
  case "serve":
    await serve();
    break;

  case "migrate": {
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
    process.exit(0);
  }

  case "seed": {
    const [{ createDatabase }, { seedTaxonomy }] = await Promise.all([
      import("./db"),
      import("./db/seed/taxonomy"),
    ]);
    const db = createDatabase();
    await seedTaxonomy(db);
    await db.$client.close();
    console.log("[seed] taxonomy seeded");
    process.exit(0);
  }

  case "create-staff": {
    await createStaff(process.argv[3], process.argv[4]);
    process.exit(0);
  }

  case "seed-solvers": {
    await seedSolverAccounts(process.argv[3]);
    process.exit(0);
  }

  default:
    console.error(
      `Unknown command "${command}". Expected one of: serve, migrate, seed, create-staff, seed-solvers.`,
    );
    process.exit(1);
}

async function serve() {
  const [{ default: app }, { markDraining }] = await Promise.all([
    import("./index"),
    import("./lib/lifecycle"),
  ]);

  const server = Bun.serve(app);
  console.log(`[api] listening on :${server.port}`);

  let stopping = false;

  const shutdown = async (signal: "SIGTERM" | "SIGINT") => {
    if (stopping) return;
    stopping = true;

    // 1. Fail health checks while still serving. Traefik keeps routing to a
    //    stopping container until its health check notices, so stopping to
    //    accept connections first would drop whatever it sends meanwhile.
    //    Ctrl+C in a terminal (SIGINT) has no load balancer to wait for.
    markDraining();
    const drainMs = signal === "SIGTERM" ? env.SHUTDOWN_DRAIN_MS : 0;
    console.log(`[api] ${signal}: out of rotation, draining ${drainMs}ms`);
    await Bun.sleep(drainMs);

    // 2. Stop accepting and let in-flight requests finish — but only for a
    //    bounded time. Idle keep-alive connections and open WebSockets would
    //    otherwise hold the process past the container's grace period and
    //    get it SIGKILLed; feed clients reconnect to another replica.
    await Promise.race([
      server.stop(),
      Bun.sleep(env.SHUTDOWN_TIMEOUT_MS).then(() => server.stop(true)),
    ]);

    console.log("[api] stopped");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

/**
 * Staff accounts can only be made by staff, so the first one comes from
 * here. The password is read from STAFF_PASSWORD rather than argv, which
 * would leave it in shell history and the process list.
 */
async function createStaff(email: string | undefined, name: string | undefined) {
  const password = process.env.STAFF_PASSWORD ?? "";
  if (!email || !name || password.length < 8) {
    console.error(
      "Usage: STAFF_PASSWORD=<at least 8 chars> main create-staff <email> <name>",
    );
    process.exit(1);
  }

  const [{ createDatabase }, { createAuth }] = await Promise.all([
    import("./db"),
    import("./lib/auth"),
  ]);
  const db = createDatabase();
  // No headers: better-auth treats this as a trusted server-side call.
  const { user } = await createAuth(db).api.createUser({
    body: { email, name, password, role: "staff" },
  });
  await db.$client.close();
  console.log(`[create-staff] created ${user.email} (${user.id})`);
}

/**
 * The file holds passwords, so it's read from a path or stdin and never
 * copied into the image. With Docker:
 *   docker compose exec -T api bun dist/main.js seed-solvers - < accounts.json
 */
async function seedSolverAccounts(source: string | undefined) {
  if (!source) {
    console.error("Usage: main seed-solvers <accounts.json | ->");
    process.exit(1);
  }
  const text = source === "-" ? await Bun.stdin.text() : await Bun.file(source).text();

  const [{ createDatabase }, { createAuth }, { seedSolvers }] = await Promise.all([
    import("./db"),
    import("./lib/auth"),
    import("./db/seed/solvers"),
  ]);
  const db = createDatabase();
  const results = await seedSolvers(db, createAuth(db), JSON.parse(text));
  await db.$client.close();

  for (const r of results) {
    console.log(`[seed-solvers] ${r.outcome.padEnd(7)} ${r.email}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  const count = (o: string) => results.filter((r) => r.outcome === o).length;
  console.log(
    `[seed-solvers] ${count("created")} created, ${count("exists")} already existed, ${count("failed")} failed`,
  );
  if (count("failed")) process.exit(1);
}
