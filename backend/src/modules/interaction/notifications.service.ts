import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { DB } from "../../db";
import { notifications } from "../../db/schema";

export type NotifType = (typeof notifications.$inferSelect)["type"];
export type ReadFilter = "read" | "unread" | "all";

export type ListNotificationsOptions = {
  type?: NotifType;
  read?: ReadFilter;
  limit?: number;
  offset?: number;
};

/**
 * Offset pagination rather than keyset: this table is always scoped to one
 * user's own inbox, so the "skip N rows" cost never touches a large scan and
 * the composite-cursor machinery wouldn't earn its complexity here.
 */
export class NotificationsService {
  constructor(private db: DB) {}

  async list(userId: string, opts: ListNotificationsOptions = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);

    const conditions = [eq(notifications.userId, userId)];
    if (opts.type) conditions.push(eq(notifications.type, opts.type));
    if (opts.read === "unread") conditions.push(isNull(notifications.readAt));
    if (opts.read === "read") conditions.push(isNotNull(notifications.readAt));

    return this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit)
      .offset(offset);
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      );

    return row?.value ?? 0;
  }

  async markRead(userId: string, id: number) {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return row ?? null;
  }

  async markAllRead(userId: string): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      )
      .returning({ id: notifications.id });

    return rows.length;
  }
}
