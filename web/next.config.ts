import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo: há lockfiles na raiz e em web/. Fixa a raiz do app neste diretório.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
