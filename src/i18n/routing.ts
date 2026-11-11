import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['sl', 'hr', 'sr-Latn', 'bs', 'en'],
  defaultLocale: 'sl',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
