import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { migrationDatabaseUrl } from "./src/db/url";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationDatabaseUrl() },
});
