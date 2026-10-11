import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests (src/**\/*.itest.ts) run the real server actions against a separate Neon test
 * branch from .env.test — never the main database (dev and production share it). Refuses to start
 * without .env.test, or when its DATABASE_URL is the same as .env's.
 */
function databaseUrl(file: string) {
  try {
    const line = readFileSync(file, "utf8").split("\n").find((row) => row.startsWith("DATABASE_URL="));
    return line?.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "") || null;
  } catch {
    return null;
  }
}

const testUrl = databaseUrl(".env.test");
const mainUrl = databaseUrl(".env");
if (!testUrl) throw new Error("Integration tests need .env.test with DATABASE_URL of a separate Neon branch (see CLAUDE.md → Testing).");
if (testUrl === mainUrl) throw new Error(".env.test points at the main database. Use a separate Neon branch.");

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.itest.ts"],
    environment: "node",
    env: { DATABASE_URL: testUrl, REALTIME_URL: "", REALTIME_SECRET: "" },
    // One database: run files one after another.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
