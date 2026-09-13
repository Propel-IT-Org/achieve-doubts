import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });

export function createDatabase() {
	return db;
}

export type DB = typeof db;
export * from "./schema";