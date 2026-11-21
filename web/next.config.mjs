/** @type {import('next').NextConfig} */
const nextConfig = {
  // web/Dockerfile runs .next/standalone/server.js (deploy/README.md).
  output: 'standalone',
  // Trace dependencies from web/ itself, so a lockfile in a parent directory cannot move the
  // standalone layout to .next/standalone/<subdir>/server.js.
  outputFileTracingRoot: import.meta.dirname,
  poweredByHeader: false,
};

export default nextConfig;
