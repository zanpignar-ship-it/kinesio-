import 'server-only';
import { echoBody, getDdsBody, getDdsByInternalReferenceBody, submitDdsBody, withdrawDdsBody, type DdsInput } from './dds';
import { parseFault, parseOverview, type DdsOverview, type TracesFault } from './parse';
import { envelope, type TracesCredentials } from './wsse';
import { pick } from './xml';

export type TracesEnvironment = 'acceptance' | 'production';

const HOST: Record<TracesEnvironment, string> = {
  acceptance: 'https://acceptance.eudr.webcloud.ec.europa.eu',
  production: 'https://eudr.webcloud.ec.europa.eu',
};
const DDS_PATH = '/tracesnt/ws/EUDRDueDiligenceStatementServiceV4';
const ECHO_PATH = '/tracesnt/ws/EudrEchoService';

export type TracesResult<T> = { ok: true; value: T } | { ok: false; fault: TracesFault };

async function call(env: TracesEnvironment, path: string, creds: TracesCredentials, body: string): Promise<{ status: number; xml: string } | null> {
  try {
    const res = await fetch(`${HOST[env]}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'text/xml; charset=utf-8', soapaction: '""' },
      body: envelope(creds, body),
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    });
    return { status: res.status, xml: await res.text() };
  } catch {
    return null;
  }
}

const unreachable: TracesFault = { code: 'NETWORK', message: 'The EUDR Information System could not be reached.' };

/** testEcho – checks credentials and connectivity (acceptance only, per the documentation). */
export async function testEcho(env: TracesEnvironment, creds: TracesCredentials): Promise<TracesResult<string>> {
  const r = await call(env, ECHO_PATH, creds, echoBody('IZVOR'));
  if (!r) return { ok: false, fault: unreachable };
  const fault = parseFault(r.xml);
  if (fault || r.status >= 400) return { ok: false, fault: fault ?? { code: `HTTP_${r.status}`, message: '' } };
  return { ok: true, value: pick(r.xml, 'status') ?? '' };
}

export async function submitDds(env: TracesEnvironment, creds: TracesCredentials, input: DdsInput): Promise<TracesResult<string>> {
  const r = await call(env, DDS_PATH, creds, submitDdsBody(input));
  if (!r) return { ok: false, fault: unreachable };
  const fault = parseFault(r.xml);
  const uuid = pick(r.xml, 'uuid');
  if (fault || !uuid) return { ok: false, fault: fault ?? { code: `HTTP_${r.status}`, message: '' } };
  return { ok: true, value: uuid };
}

const httpFault = (status: number): TracesFault => ({ code: `HTTP_${status}`, message: `HTTP ${status}` });

export async function getDds(env: TracesEnvironment, creds: TracesCredentials, uuid: string): Promise<TracesResult<DdsOverview | null>> {
  const r = await call(env, DDS_PATH, creds, getDdsBody([uuid]));
  if (!r) return { ok: false, fault: unreachable };
  const fault = parseFault(r.xml);
  if (fault) return { ok: false, fault };
  if (r.status >= 400 || !/Envelope/.test(r.xml)) return { ok: false, fault: httpFault(r.status) };
  return { ok: true, value: parseOverview(r.xml).find((o) => o.uuid === uuid) ?? null };
}

/** Statements with this internal reference – used to find out whether a submission whose answer was lost arrived. */
export async function getDdsByInternalReference(env: TracesEnvironment, creds: TracesCredentials, internalRef: string): Promise<TracesResult<DdsOverview[]>> {
  const r = await call(env, DDS_PATH, creds, getDdsByInternalReferenceBody(internalRef));
  if (!r) return { ok: false, fault: unreachable };
  const fault = parseFault(r.xml);
  if (fault) return fault.code === 'NotFoundException' || /NOT_?FOUND/i.test(fault.code + fault.message) ? { ok: true, value: [] } : { ok: false, fault };
  if (r.status >= 400 || !/Envelope/.test(r.xml)) return { ok: false, fault: httpFault(r.status) };
  return { ok: true, value: parseOverview(r.xml) };
}

export async function withdrawDds(env: TracesEnvironment, creds: TracesCredentials, uuid: string): Promise<TracesResult<string>> {
  const r = await call(env, DDS_PATH, creds, withdrawDdsBody(uuid));
  if (!r) return { ok: false, fault: unreachable };
  const fault = parseFault(r.xml);
  if (fault) return { ok: false, fault };
  if (r.status >= 400 || !/Envelope/.test(r.xml)) return { ok: false, fault: httpFault(r.status) };
  return { ok: true, value: pick(r.xml, 'status') ?? '' };
}
