import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortida autònoma: imatge de contenidor petita.
  output: "standalone",
  // Mòduls natius: s'executen des de node_modules, no s'empaqueten.
  serverExternalPackages: ["better-sqlite3", "sharp"],
  // La foto d'una activitat va amb el formulari. Per defecte s'hi admet 1 MB, massa just: vegeu MIDA_MAXIMA_FOTO.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
