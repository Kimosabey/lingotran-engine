import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server (pnpm dev) be reached from this machine's Tailscale IP
  // without the cross-origin dev-resource warning; production is unaffected.
  allowedDevOrigins: ["100.88.22.7"],
};

export default nextConfig;
