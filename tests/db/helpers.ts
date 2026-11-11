import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set – run the DB tests with `npm run test:db`.');

export const pool = new pg.Pool({ connectionString: url, max: 4 });

type Client = pg.PoolClient;

async function inRolledBackTx<T>(setup: (c: Client) => Promise<void>, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await setup(c);
    return await fn(c);
  } finally {
    await c.query('rollback').catch(() => undefined);
    c.release();
  }
}

/** Run `fn` as an authenticated Supabase user (or as `anon` when userId is null); always rolled back. */
export function asUser<T>(userId: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
  return inRolledBackTx(async (c) => {
    await c.query(userId ? 'set local role authenticated' : 'set local role anon');
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
  }, fn);
}

/** Run `fn` as the service role (bypasses RLS, like the server with the service key); rolled back. */
export function asService<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  return inRolledBackTx(async (c) => {
    await c.query('set local role service_role');
  }, fn);
}

/** Expect a statement to fail with the given SQLSTATE (42501 = RLS / privilege, 23503 = FK, 23514 = check). */
export async function expectSqlError(c: Client, sql: string, params: unknown[], code: string): Promise<void> {
  await c.query('savepoint s');
  try {
    await c.query(sql, params);
  } catch (e) {
    await c.query('rollback to savepoint s');
    const actual = (e as { code?: string }).code;
    if (actual !== code) throw new Error(`Expected SQLSTATE ${code}, got ${actual}: ${(e as Error).message}`);
    return;
  }
  throw new Error(`Expected SQLSTATE ${code}, but the statement succeeded: ${sql}`);
}

export const ids = {
  alice: '00000000-0000-4000-a000-000000000001',
  bob: '00000000-0000-4000-a000-000000000002',
  carol: '00000000-0000-4000-a000-000000000003',
  orgA: '10000000-0000-4000-a000-00000000000a',
  orgB: '10000000-0000-4000-a000-00000000000b',
  orgC: '10000000-0000-4000-a000-00000000000c',
} as const;

/** Tenant tables with organization_id that every org gets one row in (see seedOrg). */
export const TENANT_TABLES = [
  'suppliers',
  'organization_links',
  'plot_imports',
  'plots',
  'documents',
  'plot_documents',
  'products',
  'customers',
  'shipments',
  'shipment_items',
  'shipment_plots',
  'shipment_documents',
  'upstream_references',
  'buyer_shares',
] as const;

async function seedOrg(c: Client, org: string, partner: string): Promise<void> {
  const q = (sql: string) => c.query(sql, sql.includes('$2') ? [org, partner] : [org]);
  await q(`insert into suppliers (id, organization_id, name, country, kind) values (gen_random_uuid(), $1::uuid, 'Gozd ' || $1::text, 'SI', 'forest_owner')`);
  await q(`insert into organization_links (organization_id, partner_organization_id) values ($1, $2)`);
  await q(`insert into plot_imports (organization_id, file_path, file_name, detected_crs, feature_count) values ($1::uuid, $1::text || '/imports/a.zip', 'a.zip', 'EPSG:3794', 1)`);
  await q(`insert into plots (organization_id, supplier_id, label, country, geom, area_ha, area_source, validation_status)
           select $1, s.id, 'P1', 'SI', extensions.st_setsrid(extensions.st_makepoint(14.505751, 46.049865), 4326), 1.5, 'declared', 'warning'
           from suppliers s where s.organization_id = $1`);
  await q(`insert into documents (organization_id, type, title, file_path, mime, size_bytes) values ($1::uuid, 'felling_permit', 'Dovoljenje', $1::text || '/d/x.pdf', 'application/pdf', 1000)`);
  await q(`insert into plot_documents (organization_id, plot_id, document_id)
           select $1, p.id, d.id from plots p, documents d where p.organization_id = $1 and d.organization_id = $1`);
  await q(`insert into products (organization_id, name, hs_code, species_id) select $1, 'Hlodovina smreka', '4403', id from species where scientific_name = 'Picea abies'`);
  await q(`insert into customers (organization_id, name, country) values ($1, 'Kupec', 'AT')`);
  await q(`insert into shipments (organization_id, internal_ref, customer_id, mode, activity, shipment_date, country_of_production)
           select $1, 'S-1', id, 'submit_dds', 'export', current_date, 'SI' from customers where organization_id = $1`);
  await q(`insert into shipment_items (organization_id, shipment_id, product_id, net_mass_kg)
           select $1, s.id, p.id, 24000 from shipments s, products p where s.organization_id = $1 and p.organization_id = $1`);
  await q(`insert into shipment_plots (organization_id, shipment_id, plot_id, geom_snapshot)
           select $1, s.id, p.id, p.geom from shipments s, plots p where s.organization_id = $1 and p.organization_id = $1`);
  await q(`insert into shipment_documents (organization_id, shipment_id, document_id)
           select $1, s.id, d.id from shipments s, documents d where s.organization_id = $1 and d.organization_id = $1`);
  await q(`insert into upstream_references (organization_id, shipment_id, kind, reference_no)
           select $1, id, 'dds', '26SIXXXX' from shipments where organization_id = $1`);
  await q(`insert into buyer_shares (organization_id, token_hash, expires_at, shipment_ids)
           select $1, extensions.digest(gen_random_uuid()::text, 'sha256'), now() + interval '30 days', array[id] from shipments where organization_id = $1`);
}

/** Reset and seed: alice ∈ A (owner), bob ∈ B (owner), carol ∈ A (member) and B (member); C is a partner org with no members. */
export async function seedTwoOrgs(): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('truncate organizations, audit_log cascade');
    await c.query('delete from auth.users');
    await c.query(`insert into auth.users (id, email) values ($1, 'alice@a.test'), ($2, 'bob@b.test'), ($3, 'carol@ab.test')`, [ids.alice, ids.bob, ids.carol]);
    await c.query(
      `insert into organizations (id, name, country, kind, size) values
        ($1, 'Žaga A', 'SI', 'operator', 'small'), ($2, 'Uvoznik B', 'SI', 'importer', 'medium'), ($3, 'Partner C', 'BA', 'exporter', 'small')`,
      [ids.orgA, ids.orgB, ids.orgC],
    );
    await c.query(
      `insert into memberships (organization_id, user_id, role) values
        ($1, $3, 'owner'), ($2, $4, 'owner'), ($1, $5, 'member'), ($2, $5, 'member')`,
      [ids.orgA, ids.orgB, ids.alice, ids.bob, ids.carol],
    );
    await seedOrg(c, ids.orgA, ids.orgC);
    await seedOrg(c, ids.orgB, ids.orgC);
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}
