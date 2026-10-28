import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Monorepo root: @lp/shared and the hoisted node_modules live there.
const repoRoot = path.join(here, '..', '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  transpilePackages: ['@lp/shared'],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
