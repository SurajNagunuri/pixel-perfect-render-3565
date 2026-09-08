import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // GitHub Pages serves the app from /<repo-name>/, so the build step
  // passes GH_PAGES_BASE (e.g. "/borrower-copilot/"). Locally this is "/".
  base: process.env.GH_PAGES_BASE || "/",
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // The app is fully client-side, so every route is prerendered to static
    // HTML at build time. This output (dist/client) is what GitHub Pages hosts.
    prerender: { enabled: true },
    pages: [
      { path: "/" },
      { path: "/assess" },
      { path: "/results" },
      { path: "/card" },
      { path: "/rules" },
    ],
  },
});
