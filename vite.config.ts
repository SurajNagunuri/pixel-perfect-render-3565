import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    pages: undefined as never,
  },
  nitro: {
    prerender: { crawlLinks: true, routes: ["/", "/assess", "/results", "/card", "/rules"] },
  },
});
