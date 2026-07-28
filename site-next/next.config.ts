import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server (pnpm dev) be reached from this machine's Tailscale IP
  // without the cross-origin dev-resource warning; production is unaffected.
  allowedDevOrigins: ["100.88.22.7"],
  // Pin the workspace root explicitly -- Turbopack's automatic inference
  // started failing ("couldn't find next/package.json from .../app") after
  // installing Playwright's devDependencies, since this project sits inside
  // a larger repo without its own root-level package.json to anchor on.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
