import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES = ['sl', 'hr', 'sr-Latn', 'bs', 'en'] as const;
const MACHINE = ['hr', 'sr-Latn', 'bs'];
type Tree = { [k: string]: string | boolean | Tree };

const path = (l: string) => new URL(`../../messages/${l}.json`, import.meta.url);
const load = (l: string): Tree => JSON.parse(readFileSync(path(l), 'utf8')) as Tree;

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    if (k === '_meta') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (typeof v === 'object') Object.assign(out, flatten(v, key));
  }
  return out;
}

const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const base = flatten(load('sl'));

describe.each(LOCALES)('messages/%s.json', (locale) => {
  it('exists', () => expect(existsSync(path(locale))).toBe(true));
  const messages = existsSync(path(locale)) ? flatten(load(locale)) : {};
  it('has exactly the same keys as sl', () => expect(Object.keys(messages).sort()).toEqual(Object.keys(base).sort()));
  it('has no empty strings', () => {
    for (const [k, v] of Object.entries(messages)) expect(v.trim(), k).not.toBe('');
  });
  it('uses the same {params} as sl', () => {
    for (const [k, v] of Object.entries(base)) expect(params(messages[k] ?? ''), k).toEqual(params(v));
  });
  if (MACHINE.includes(locale)) {
    it('is marked as machine translated', () => {
      const meta = existsSync(path(locale)) ? load(locale)._meta : undefined;
      expect(typeof meta === 'object' && meta.machineTranslated).toBe(true);
    });
  }
});

describe('app keys', () => {
  it('sl has the keys the home page needs', () => {
    for (const k of ['common.appName', 'common.disclaimer', 'home.title', 'home.subtitle', 'home.deadlineLarge', 'home.deadlineSmall']) {
      expect(base[k], k).toBeTruthy();
    }
  });
});
