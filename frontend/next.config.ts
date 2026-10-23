import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
