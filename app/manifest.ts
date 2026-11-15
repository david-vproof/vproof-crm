import type { MetadataRoute } from "next";

/**
 * El que fa instal·lable el portal: «Afegeix a la pantalla d'inici» llegeix
 * això. S'obre directament al CRM i sense la barra del navegador. El sistema
 * el demana sense galeta, per això el middleware el deixa passar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "vproof CRM",
    short_name: "vproof CRM",
    description: "Portal de gestió comercial per a distribució de producte",
    lang: "ca",
    start_url: "/crm",
    scope: "/",
    display: "standalone",
    background_color: "#f7faf9",
    theme_color: "#f7faf9",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/mascara", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
