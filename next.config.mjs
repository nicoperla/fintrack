/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // react-pdf is Node-only: load it at runtime instead of bundling it into the route.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
