import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { username } from "better-auth/plugins/username";
import { createDatabase, type DB } from "../db";
import * as schema from "../db/schema";
import { env } from "../env";
import { achieveSsoPlugin } from "./achieve-sso-plugin";
import { sendMail } from "./mailer";
import { ac, roles } from "./permissions";

export function createAuth(database: DB) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        batches: schema.batches,
        studentProfiles: schema.studentProfiles,
        solverProfiles: schema.solverProfiles,
        achieveSsoTokens: schema.achieveSsoTokens,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      // No self-registration for anyone. Solvers/staff are created only
      // via the admin panel (admin.api.createUser); students only via the
      // Achieve SSO handshake (achieve-sso-plugin.ts, internalAdapter
      // .createUser directly — unaffected by this HTTP-level flag).
      disableSignUp: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await sendMail({
          to: user.email,
          subject: "Reset your Achieve Doubts password",
          text: `Reset your password: ${url}\n\nIf you didn't request this, ignore this email.`,
        });
      },
      password: {
        hash(password) {
          return Bun.password.hash(password);
        },
        verify(data) {
          return Bun.password.verify(data.password, data.hash);
        },
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail({
          to: user.email,
          subject: "Verify your Achieve Doubts email",
          text: `Verify your email: ${url}`,
        });
      },
    },
    trustedOrigins: [env.CORS_ORIGIN, env.ADMIN_ORIGIN],
    plugins: [
      // Solver/staff sign-in. Students never use this — see
      // achieve-sso-plugin.ts for the SSO-only student path.
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
      }),
      admin({
        ac,
        roles,
        defaultRole: "student",
        adminRoles: ["staff"],
      }),
      // Achieve SSO handshake — the only way a student account is ever
      // created or signed in. See achieve-sso-plugin.ts.
      achieveSsoPlugin(),
    ],
    session: {
      cookieCache: {
        enabled: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"]["session"];
export type User = Auth["$Infer"]["Session"]["user"];
export type AuthType = {
  user: User | null;
  session: Session | null;
};
export const auth = createAuth(createDatabase());
