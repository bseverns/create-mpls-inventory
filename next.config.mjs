/** @type {import('next').NextConfig} */
const nextConfig = {
  // Builds a server for the Docker image
  output: "standalone",
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
