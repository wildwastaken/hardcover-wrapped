/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Served at allenliu.dev/wrapped (the personal site rewrites /wrapped/* here).
  basePath: '/wrapped',
  env: { NEXT_PUBLIC_BASE_PATH: '/wrapped' },
}
export default nextConfig
