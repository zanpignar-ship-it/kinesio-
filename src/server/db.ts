import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __rentoraPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return new Pool({ connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
}

export function pool(): Pool {
  // Reuse across hot reloads in development.
  if (!globalThis.__rentoraPool) globalThis.__rentoraPool = createPool();
  return globalThis.__rentoraPool;
}

export type Tx = {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T>;
  maybeOne<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null>;
};

function wrap(client: PoolClient): Tx {
  return {
    async query(sql, params) {
      return (await client.query(sql, params as unknown[])).rows;
    },
    async one(sql, params) {
      const rows = (await client.query(sql, params as unknown[])).rows;
      if (rows.length !== 1) throw new Error(`Expected exactly one row, got ${rows.length}`);
      return rows[0];
    },
    async maybeOne(sql, params) {
      const rows = (await client.query(sql, params as unknown[])).rows;
      return rows[0] ?? null;
    },
  };
}

export type TenantContext = { orgId: string; userId?: string | null; platformAdmin?: boolean };

async function run<T>(setup: (c: PoolClient) => Promise<void>, fn: (tx: Tx) => Promise<T>, p: Pool = pool()): Promise<T> {
  const client = await p.connect();
  try {
    await client.query("begin");
    await setup(client);
    const result = await fn(wrap(client));
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` in a transaction scoped to one tenant. Row-level security in
 * PostgreSQL restricts every tenant table to `ctx.orgId`; settings are
 * transaction-local so pooled connections never carry a stale tenant.
 */
export function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>, p?: Pool): Promise<T> {
  return run(
    async (c) => {
      await c.query("select set_config('app.org_id', $1, true), set_config('app.user_id', $2, true), set_config('app.platform_admin', $3, true)", [
        ctx.orgId,
        ctx.userId ?? "",
        ctx.platformAdmin ? "on" : "",
      ]);
    },
    fn,
    p,
  );
}

/** Transaction bound to an authenticated user but no tenant (membership lookups). */
export function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>, p?: Pool): Promise<T> {
  return run(async (c) => {
    await c.query("select set_config('app.user_id', $1, true)", [userId]);
  }, fn, p);
}

/** Transaction with no tenant context: only global tables and public rows are visible. */
export function withPublic<T>(fn: (tx: Tx) => Promise<T>, p?: Pool): Promise<T> {
  return run(async () => {}, fn, p);
}

export function isUniqueViolation(e: unknown, constraint?: string) {
  const err = e as { code?: string; constraint?: string };
  return err?.code === "23505" && (!constraint || err.constraint === constraint);
}

export function isExclusionViolation(e: unknown) {
  return (e as { code?: string })?.code === "23P01";
}
