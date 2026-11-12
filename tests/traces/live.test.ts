// Calls the real acceptance Echo service. Runs only with LIVE_TRACES=1 (network + optional real credentials).
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const live = process.env.LIVE_TRACES === '1';

describe.skipIf(!live)('EUDR acceptance echo (live)', () => {
  it('answers our envelope (authentication fault with dummy credentials, OK with real ones)', async () => {
    const { testEcho } = await import('@/lib/traces/client');
    const creds = {
      username: process.env.TRACES_USERNAME ?? 'lestrace-dummy-user',
      authKey: process.env.TRACES_AUTH_KEY ?? 'dummy-key',
      clientId: process.env.TRACES_CLIENT_ID ?? 'eudr-test',
    };
    const r = await testEcho('acceptance', creds);
    console.log(JSON.stringify(r));
    if (process.env.TRACES_AUTH_KEY) expect(r).toMatchObject({ ok: true });
    else expect(r.ok).toBe(false);
  }, 70_000);
});
