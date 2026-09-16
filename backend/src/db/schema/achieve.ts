import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "../auth-schema";
import { batches } from "./identity";

// One-time redirect tokens for the Achieve SSO handshake. A dedicated table
// rather than better-auth's `verification`, because:
//   - single-use consumption must be one atomic compare-and-consume
//     statement, which better-auth's adapter API cannot express;
//   - `verification` is indexed on `identifier`, not `value`, so a lookup by
//     token would be a full scan.
// `tokenHash` stores sha256(token) — the raw token is never persisted.
export const achieveSsoTokens = pgTable(
	"achieve_sso_tokens",
	{
		tokenHash: text("token_hash").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		batchId: varchar("batch_id", { length: 64 })
			.notNull()
			.references(() => batches.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at").notNull(),
		consumedAt: timestamp("consumed_at"),
		createdIp: text("created_ip"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("idx_achieve_tokens_expires").on(table.expiresAt)],
);
