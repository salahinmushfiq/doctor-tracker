import type { NextConfig } from "next";

// Optional same-origin API proxy (decisions D27). When API_PROXY_TARGET is set (e.g. https://my-api.onrender.com), requests to
// /api/* on the frontend's own origin are forwarded to the API. The browser then sees a first-party cookie, which survives
// Safari/ITP and third-party-cookie blocking. Pair with NEXT_PUBLIC_API_BASE_URL=/api/v1 and COOKIE_SAMESITE=lax on the API.
const apiProxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    return apiProxyTarget ? [{ source: '/api/:path*', destination: `${apiProxyTarget}/api/:path*` }] : [];
  },
  // Private, authenticated, client-fetched UI: nothing here should be statically cached or
  // prerendered with data, so Cache Components / partial prefetching stay OFF (decisions D22).
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
