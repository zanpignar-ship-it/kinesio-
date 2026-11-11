import 'server-only';
import { geometryFromDb } from '@/lib/plots/geometry';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ArchiveInput } from './build';

const TABLES = [
  'suppliers', 'customers', 'products', 'documents', 'plot_documents', 'plot_imports',
  'shipments', 'shipment_items', 'shipment_plots', 'shipment_documents', 'upstream_references', 'audit_log',
] as const;
const PAGE = 1000;

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function allRows(supabase: Supabase, table: string, organizationId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from(table as any) as any)
      .select('*')
      .eq('organization_id', organizationId)
      .order(table === 'audit_log' ? 'id' : 'created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Everything the organization has stored, read with the user's own session (RLS applies). */
export async function collectArchive(organizationId: string, organizationName: string): Promise<ArchiveInput> {
  const supabase = await createServerSupabase();
  const plots = (await allRows(supabase, 'plots', organizationId)).map((p) => ({ ...p, geom: geometryFromDb(p.geom) }));
  const tables: ArchiveInput['tables'] = {};
  for (const t of TABLES) tables[t] = await allRows(supabase, t, organizationId);
  // geometry snapshots are already in plots.geojson style; keep them as GeoJSON text in the CSV
  tables.shipment_plots = tables.shipment_plots!.map((r) => ({ ...r, geom_snapshot: geometryFromDb(r.geom_snapshot) }));

  const files: ArchiveInput['files'] = [];
  const wanted = [
    ...tables.documents!.map((d) => ({ bucket: 'documents', path: String(d.file_path) })),
    ...tables.plot_imports!.map((d) => ({ bucket: 'plot-imports', path: String(d.file_path) })),
  ];
  for (const f of wanted) {
    const { data } = await supabase.storage.from(f.bucket).download(f.path);
    if (data) files.push({ path: `${f.bucket}/${f.path.split('/').slice(1).join('/')}`, data: new Uint8Array(await data.arrayBuffer()) });
  }
  return { organizationName, generatedAt: new Date().toISOString(), plots, tables, files };
}
