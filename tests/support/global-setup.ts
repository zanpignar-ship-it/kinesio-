import { Client } from "pg";
import { migrate } from "../../scripts/migrate";

/** Resets the test database schema and applies all migrations once per run. */
export default async function setup() {
  const owner = process.env.TEST_DATABASE_OWNER_URL ?? "postgres://rentora_owner:rentora_owner_dev@localhost:5432/rentora_test";
  const c = new Client({ connectionString: owner });
  await c.connect();
  await c.query("drop schema if exists public cascade; create schema public authorization rentora_owner;");
  await c.query("create extension if not exists pgcrypto; create extension if not exists citext; create extension if not exists btree_gist;").catch(() => {});
  await c.end();
  await migrate(owner, () => {});
}
