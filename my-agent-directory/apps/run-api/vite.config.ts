import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite";
import { startupLogPlugin } from "../shared/startup-log-plugin";

export default defineConfig({
  plugins: [
    devServer({
      entry: "src/index.ts", // The Hono app entry point
    }),
    startupLogPlugin(),
  ],
  server: {
    port: 3003,
    // Restrict allowed hosts to avoid DNS rebinding risks.
    // Never use permissive settings in production.
    allowedHosts: ["localhost", "127.0.0.1"],
  },
});
