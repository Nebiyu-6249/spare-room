import type { NextConfig } from "next";

// Static export only: no server, no API routes, no runtime env vars.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
