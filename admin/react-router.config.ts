import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode, like the main site.
  ssr: false,
  prerender() {
    return ["/login"];
  },
} satisfies Config;
