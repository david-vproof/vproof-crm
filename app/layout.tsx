import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wine Backend",
  description: "Portal de gestió comercial per a distribució de vi",
  applicationName: "Wine Backend",
  // Afegida a la pantalla d'inici d'iOS s'obre a pantalla completa, amb aquest
  // nom i la barra d'estat del color de la capçalera. El manifest surt de
  // `app/manifest.ts` i les icones, de `app/icon.tsx` i `app/apple-icon.tsx`.
  appleWebApp: { capable: true, title: "Wine Backend", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Com una app: iOS amplia la pàgina en enfocar un camp amb la lletra de menys
  // de 16px, i en sortir-ne s'hi queda, moguda. Amb l'escala màxima a 1 no ho
  // fa (i a Android tampoc es pot ampliar amb els dits).
  maximumScale: 1,
  // A Android, el teclat encongeix la pantalla en comptes de tapar-la: la
  // capçalera es queda al seu lloc i el panell es desplaça fins al camp.
  interactiveWidget: "resizes-content",
  themeColor: "#faf7f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={`${inter.variable} ${display.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
