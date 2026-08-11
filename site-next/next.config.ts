import path from "node:path";
import type { NextConfig } from "next";

// Security headers. Vercel supplies HSTS on its own; everything below is
// absent by default and each line closes a real gap the audit found.
//
// The CSP is deliberately explicit rather than copied wholesale: this site
// loads no third-party script, style, font or image of any kind (fonts are
// self-hosted by next/font, charts are inline SVG since ECharts was removed),
// so every source can be locked to 'self'. 'unsafe-inline' is required for
// style-src because Tailwind/React emit inline style attributes, and for
// script-src because the pre-hydration theme script in app/layout.tsx must run
// before paint to avoid a flash of the wrong theme.
// React's development build uses eval() for debugging features (reconstructing
// call stacks across environments). It never does so in production, so
// 'unsafe-eval' is granted to `next dev` only -- without this, the dev server
// serves a page whose own framework can't boot.
const isDev = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // The Explorer fetches its own CSVs from public/data. `next dev` also needs
  // its HMR websocket back to localhost.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

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
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      {
        // The corpus CSVs are content-addressed by build, not fingerprinted in
        // the filename, so they must revalidate rather than be cached forever
        // -- a stale dataset behind fresh page copy is exactly the mismatch
        // the old static site's netlify.toml guarded against.
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
