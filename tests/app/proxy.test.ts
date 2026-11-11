import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const seenByIntl: string[] = [];

vi.mock('next-intl/middleware', () => ({
  default: () => (request: NextRequest) => {
    seenByIntl.push(request.cookies.get('sb-test-auth-token')?.value ?? '');
    return NextResponse.next({ request: { headers: request.headers } });
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: (c: { name: string; value: string; options: object }[]) => void } }) => ({
    auth: {
      getClaims: async () => {
        // Simulate a token refresh.
        opts.cookies.setAll([{ name: 'sb-test-auth-token', value: 'fresh', options: { path: '/' } }]);
        return { data: null, error: null };
      },
    },
  }),
}));

beforeEach(() => {
  seenByIntl.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
});

describe('proxy', () => {
  it('refreshes the session before next-intl builds the response and sends the new cookie', async () => {
    const { default: proxy } = await import('@/proxy');
    const request = new NextRequest('https://lestrace.test/sl', { headers: { cookie: 'sb-test-auth-token=stale' } });
    const response = await proxy(request);
    expect(seenByIntl).toEqual(['fresh']);
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('fresh');
  });
});
