import { defineConfig } from "tsup";

// Baut den pg-boss-Worker nach dist/worker.js (PM2-Prozess „wichtel-worker“).
export default defineConfig({
  entry: { worker: "src/worker/index.ts" },
  format: ["cjs"],
  outDir: "dist",
  target: "node22",
  platform: "node",
  clean: true,
  sourcemap: true,
  external: ["@prisma/client", "pg-native"],
  noExternal: [/^(?!@prisma\/client).*/],
});
