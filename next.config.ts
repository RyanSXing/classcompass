import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  agentRules: false,
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ['sharp', 'pdfjs-dist'],
  outputFileTracingIncludes: { '/api/*': ['./lib/fixtures/extractions.json', './public/demo/**/*'] },
  outputFileTracingExcludes: { '/*': ['./.local/**/*', './.env*', './tests/**/*', './tmp/**/*', './playwright-report/**/*', './test-results/**/*'] },
};
export default config;
