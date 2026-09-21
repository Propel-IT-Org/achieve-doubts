import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "..";
import type { Auth } from "../../lib/auth";
import { solverProfiles, user } from "../schema";

/**
 * Bulk-creates solver accounts from a JSON list — the same accounts an admin
 * could add one by one in the admin panel:
 *
 *   [{ "name", "email", "phone", "institution", "password", "confirm_password" }]
 *
 * Accounts go through better-auth's createUser, so passwords are hashed
 * exactly as the admin panel's are. Existing emails are skipped, so a list can
 * be re-run safely. Passwords are never printed.
 */

/** "+880 1712-345678" -> "01712-345678", the admin form's format. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^880/, "0");
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** "Mathematics  ,DU " -> "Mathematics, DU". */
const tidy = (text: string) =>
  text.trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");

const accountSchema = z
  .object({
    name: z.string().transform(tidy).pipe(z.string().min(1)),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    phone: z.string().optional(),
    institution: z.string().optional(),
    password: z.string().min(8),
    confirm_password: z.string().optional(),
  })
  .refine((a) => a.confirm_password === undefined || a.confirm_password === a.password, {
    message: "password and confirm_password differ",
  });

export type SeedResult = { email: string; outcome: "created" | "exists" | "failed"; detail?: string };

export async function seedSolvers(db: DB, auth: Auth, input: unknown): Promise<SeedResult[]> {
  if (!Array.isArray(input)) throw new Error("Expected a JSON array of accounts");
  const results: SeedResult[] = [];

  for (const [index, raw] of input.entries()) {
    const parsed = accountSchema.safeParse(raw);
    const label = (raw as { email?: string })?.email ?? `#${index + 1}`;
    if (!parsed.success) {
      results.push({ email: label, outcome: "failed", detail: parsed.error.issues[0]?.message });
      continue;
    }
    const account = parsed.data;

    const phone = account.phone ? normalizePhone(account.phone) : null;
    if (account.phone && !phone) {
      results.push({ email: account.email, outcome: "failed", detail: `invalid phone ${account.phone}` });
      continue;
    }

    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, account.email));
    if (existing) {
      results.push({ email: account.email, outcome: "exists" });
      continue;
    }

    if (phone) {
      const [taken] = await db
        .select({ userId: solverProfiles.userId })
        .from(solverProfiles)
        .where(eq(solverProfiles.phone, phone));
      if (taken) {
        results.push({ email: account.email, outcome: "failed", detail: `phone ${phone} already used` });
        continue;
      }
    }

    try {
      // No headers: better-auth treats this as a trusted server-side call.
      const created = await auth.api.createUser({
        body: {
          email: account.email,
          password: account.password,
          name: account.name,
          role: "solver",
        },
      });
      await db.insert(solverProfiles).values({
        userId: created.user.id,
        phone,
        institution: account.institution ? tidy(account.institution) : null,
      });
      results.push({ email: account.email, outcome: "created" });
    } catch (err) {
      results.push({
        email: account.email,
        outcome: "failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
