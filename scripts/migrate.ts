/**
 * Forward-only SQL migration runner. Each file in db/migrations runs once,
 * inside a transaction, recorded in schema_migrations with its checksum.
 * Usage: DATABASE_OWNER_URL=... tsx scripts/migrate.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { Client } from "pg";

export async function migrate(connectionString: string, log = console.log) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`create table if not exists schema_migrations (
      name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    const dir = path.join(process.cwd(), "db", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query<{ name: string; checksum: string }>("select name, checksum from schema_migrations");
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));
    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const prev = applied.get(file);
      if (prev) {
        if (prev !== checksum) throw new Error(`Migration ${file} was modified after being applied. Create a new migration instead.`);
        continue;
      }
      log(`→ applying ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name, checksum) values ($1, $2)", [file, checksum]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) {
    console.error("DATABASE_OWNER_URL is not set");
    process.exit(1);
  }
  migrate(url).then(() => console.log("migrations up to date"), (e) => { console.error(e); process.exit(1); });
}
