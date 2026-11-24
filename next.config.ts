import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default createNextIntlPlugin('./src/i18n/request.ts')(config);
