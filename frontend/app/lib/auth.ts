import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { roles, ac } from "@achieve/doubts-backend/permissions";
import { API_URL } from "./api";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    adminClient({
      ac,
      roles,
    }),
  ],
});
