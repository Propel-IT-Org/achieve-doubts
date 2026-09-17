import { createDatabase } from "../db";
import { createAuth } from "./auth";

/**
 * Entry point for the better-auth CLI (`bun run auth:generate`) only. The app
 * builds its instance through the DI container; importing this from app code
 * would open a second database pool.
 */
export const auth = createAuth(createDatabase());
