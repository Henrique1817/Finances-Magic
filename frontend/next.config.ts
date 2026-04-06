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

  /**
   * Axios no bundle do servidor costuma gerar `__webpack_modules__[id] is not a function`
   * em alguns setups (Windows / Webpack). Usar o pacote de node_modules no runtime evita isso.
   */
  serverExternalPackages: ["axios"],
};

export default nextConfig;
