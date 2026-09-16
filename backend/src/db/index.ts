import { drizzle } from "drizzle-orm/bun-sql";
import { env } from "../env";
import * as schema from "./schema";

export function createDatabase() {
  const queryClient = new Bun.SQL({
    adapter: "postgres",
    url: env.DATABASE_URL,
  });
  return drizzle(queryClient, { schema });
}

export type DB = ReturnType<typeof createDatabase>;
