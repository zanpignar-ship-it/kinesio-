import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import i18next from 'eslint-plugin-i18next';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'src/lib/db/database.types.ts', 'playwright-report/**', 'test-results/**'] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    ignores: ['src/components/ui/**'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
];

export default config;
