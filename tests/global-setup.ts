import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export default async function () {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgres://resist:resist@localhost:5432/resist_test";
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await client`DROP SCHEMA IF EXISTS public CASCADE`;
  await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await client`CREATE SCHEMA public`;
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}
