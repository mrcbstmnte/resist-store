import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://resist:resist@localhost:5432/resist_test",
      DB_POOL_SIZE: "10",
    },
    globalSetup: "./tests/global-setup.ts",
    fileParallelism: false,
  },
});
