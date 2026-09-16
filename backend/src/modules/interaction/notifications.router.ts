import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/di";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { parseIdParam } from "./shared";

const listQuerySchema = z.object({
  type: z
    .enum([
      "assigned",
      "released",
      "solved",
      "comment",
      "followup",
      "override",
    ])
    .optional(),
  read: z.enum(["read", "unread", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const notificationsRouter = new Hono<AppEnv>()
  .get(
    "/",
    requireAuth,
    requirePermission({ notification: ["list"] }),
    zValidator("query", listQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const items = await c.var.di
        .get("notifications")
        .list(c.var.user.id, query);
      return c.json({ items });
    },
  )
  .get(
    "/unread",
    requireAuth,
    requirePermission({ notification: ["list"] }),
    async (c) => {
      const count = await c.var.di
        .get("notifications")
        .unreadCount(c.var.user.id);
      return c.json({ count });
    },
  )
  .post(
    "/read-all",
    requireAuth,
    requirePermission({ notification: ["update"] }),
    async (c) => {
      const updated = await c.var.di
        .get("notifications")
        .markAllRead(c.var.user.id);
      return c.json({ updated });
    },
  )
  .post(
    "/:id/read",
    requireAuth,
    requirePermission({ notification: ["update"] }),
    async (c) => {
      const id = parseIdParam(c.req.param("id"));
      if (!id) return c.json({ error: "Invalid notification id" }, 400);

      const row = await c.var.di
        .get("notifications")
        .markRead(c.var.user.id, id);

      if (!row) return c.json({ error: "Notification not found" }, 404);
      return c.json({ notification: row });
    },
  );
