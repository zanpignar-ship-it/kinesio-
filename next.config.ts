import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Plot imports send up to 2,000 geometries to a server action.
  experimental: { serverActions: { bodySizeLimit: '25mb' } },
};

export default withNextIntl(nextConfig);
