import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo: há package-lock na raiz do repositório; fixa o tracing neste app.
  outputFileTracingRoot: path.join(__dirname),

  /**
   * Evita erro "SegmentViewNode ... not in React Client Manifest" (bug do
   * DevTools / RSC em alguns ambientes Windows + cache inconsistente).
   */
  experimental: {
    devtoolSegmentExplorer: false,
  },

  /** Cache em RAM no dev reduz ENOENT em `.next/cache/webpack/.../*.pack.gz`. */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
