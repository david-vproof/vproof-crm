import { ICONES } from "@/components/Icones";
import { llegeixCorreus, llegeixTelefons } from "@/domini/contacte";

export type MenaContacte = "telefon" | "correu";

/** Petits dins d'una cel·la de taula, normals al costat d'un camp i grans al telèfon, per al dit. */
const MIDES = {
  petita: "size-6 [&>svg]:size-3.5",
  normal: "size-[34px] [&>svg]:size-4",
  gran: "size-9 [&>svg]:size-[18px]",
} as const;

export type MidaBoto = keyof typeof MIDES;

function Boto({
  href,
  etiqueta,
  mida,
  whatsapp = false,
  children,
}: {
  href: string;
  etiqueta: string;
  mida: MidaBoto;
  whatsapp?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      title={etiqueta}
      aria-label={etiqueta}
      // WhatsApp s'obre a part: al mòbil, a l'app; a l'ordinador, sense perdre el portal.
      {...(whatsapp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`grid shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition ${
        whatsapp ? "hover:border-emerald-600 hover:text-emerald-700" : "hover:border-ink hover:text-ink"
      } ${MIDES[mida]}`}
    >
      {children}
    </a>
  );
}

/** Si el valor porta algun número o adreça amb què es pugui fer res. */
export function teContacte(mena: MenaContacte, valor: unknown) {
  return mena === "correu" ? llegeixCorreus(valor).length > 0 : llegeixTelefons(valor).length > 0;
}

/**
 * Els botons d'un telèfon o d'un correu: per cada número, trucar i, si és un
 * mòbil, WhatsApp; per cada adreça, escriure-hi. El que no és un número ni una
 * adreça («whatsapp», un nom sol) no en porta cap.
 */
export function BotonsContacte({ mena, valor, mida = "normal" }: { mena: MenaContacte; valor: unknown; mida?: MidaBoto }) {
  const Telefon = ICONES.telefon;
  const Whatsapp = ICONES.whatsapp;
  const Correu = ICONES.correu;

  if (mena === "correu") {
    return (
      <>
        {llegeixCorreus(valor).map((adreca) => (
          <Boto key={adreca} href={`mailto:${adreca}`} etiqueta={`Escriu a ${adreca}`} mida={mida}>
            <Correu />
          </Boto>
        ))}
      </>
    );
  }

  return (
    <>
      {llegeixTelefons(valor).map((telefon) => (
        // Trucar i WhatsApp del mateix número van junts: si no hi caben, baixen tots dos.
        <span key={telefon.trucada} className="flex shrink-0 items-center gap-[inherit]">
          <Boto href={telefon.trucada} etiqueta={`Truca al ${telefon.text}`} mida={mida}>
            <Telefon />
          </Boto>
          {telefon.whatsapp ? (
            <Boto href={telefon.whatsapp} etiqueta={`WhatsApp al ${telefon.text}`} mida={mida} whatsapp>
              <Whatsapp />
            </Boto>
          ) : null}
        </span>
      ))}
    </>
  );
}

/** Una cel·la de taula amb un telèfon o un correu: els botons al davant, perquè el text es pot retallar. */
export function ValorContacte({ mena, text }: { mena: MenaContacte; text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <BotonsContacte mena={mena} valor={text} mida="petita" />
      <span className="ml-0.5 truncate text-muted">{text}</span>
    </span>
  );
}
