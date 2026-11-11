import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENTITIES, FIELDS } from '@/lib/masterdata/config';

const sl = JSON.parse(readFileSync(new URL('../../messages/sl.json', import.meta.url), 'utf8')) as { md: { fields: Record<string, string> } };

describe('master data labels', () => {
  it('every form field has a translated label', () => {
    for (const e of ENTITIES) for (const f of FIELDS[e]) expect(sl.md.fields[f.name], `${e}.${f.name}`).toBeTruthy();
  });
});
