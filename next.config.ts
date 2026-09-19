import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Includes multipart overhead while the editor enforces a 5 MB image limit.
    serverActions: { bodySizeLimit: '6mb' },
  },
};

export default nextConfig;
