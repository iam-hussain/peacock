import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CORS for /api/* lives in src/proxy.ts — it needs OPTIONS preflight handling,
  // which static headers() can't provide.
};

export default nextConfig;
