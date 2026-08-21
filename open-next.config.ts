import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // R2 is not enabled on this Cloudflare account yet. OpenNext uses its
  // safe in-memory fallback until persistent incremental caching is enabled.
});
