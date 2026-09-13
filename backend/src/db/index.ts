import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export function createDatabase() {
	const queryClient = postgres(env.DATABASE_URL);
	return drizzle(queryClient, { schema });
}

export type DB = ReturnType<typeof createDatabase>;
