import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortida autònoma: imatge de contenidor petita per a Cloud Run.
  output: "standalone",
  // La fulla de vins llegeix les fonts Maison del disc: han d'anar a la sortida autònoma.
  outputFileTracingIncludes: { "/api/crm/activitats/[id]/fulla-vins": ["./components/pdf/fonts/**"] },
  // La foto d'una activitat va amb el formulari. Per defecte s'hi admet 1 MB, massa just: vegeu MIDA_MAXIMA_FOTO.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: {
    // Fotografies dels articles del mode demo, servides per la botiga.
    remotePatterns: [{ protocol: "https", hostname: "jaumejorda.com", pathname: "/wp-content/uploads/**" }],
  },
};

export default nextConfig;
