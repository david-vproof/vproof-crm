import { COPA } from "@/components/Marca";

/**
 * El segell de l'app per a les icones: la copa en blanc sobre vi. Es renderitza
 * amb Satori (`next/og`), que no entén classes: només estils en línia.
 */
export function SegellApp({ mida, radi, escala }: { mida: number; radi: number; escala: number }) {
  const copa = mida * escala;
  return (
    <div
      style={{
        width: mida,
        height: mida,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#8c2f45",
        borderRadius: radi,
      }}
    >
      <svg width={copa} height={copa} viewBox="0 0 24 24" fill="none">
        <path d={COPA.cos} fill="#ffffff" />
        <path d={COPA.peu} stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
