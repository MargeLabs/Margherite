/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Identifiant de cette version : l'app installée sur l'iPhone le compare à celui du serveur pour savoir qu'elle est périmée (src/lib/autoUpdate.ts).
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'local' },
};

export default nextConfig;

