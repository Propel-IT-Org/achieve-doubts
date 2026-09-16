import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";
import { roles, ac } from "@achieve/doubts-backend/permissions";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [
    adminClient({
      ac,
      roles,
    }),
    usernameClient(),
  ],
});
