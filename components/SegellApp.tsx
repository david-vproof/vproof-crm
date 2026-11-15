import { CREU } from "@/components/Marca";

/**
 * El segell de l'app per a les icones: l'escut amb la creu, en blanc sobre el
 * color de la marca. Es renderitza amb Satori (`next/og`), que no entén
 * classes: només estils en línia.
 */
export function SegellApp({ mida, radi, escala }: { mida: number; radi: number; escala: number }) {
  const emblema = mida * escala;
  return (
    <div
      style={{
        width: mida,
        height: mida,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f766e",
        borderRadius: radi,
      }}
    >
      <svg width={emblema} height={emblema} viewBox="0 0 24 24">
        <path d={CREU.escut} fill="#ffffff" />
        <path d={CREU.creu} fill="#0f766e" />
      </svg>
    </div>
  );
}
