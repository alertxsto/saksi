// deploy/deploy.sh builds into a side directory (SAKSI_DIST_DIR=.next-new) while the
// live server keeps serving .next, then swaps the directories. Unset means the default.
const distDir = process.env.SAKSI_DIST_DIR || '.next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  poweredByHeader: false,
  // The Docker kit copies .next/standalone into the runtime image.
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
