import { NOM_MES, type ResumFacturacio } from "@/domini/facturacio";
import { euros } from "@/lib/format";

/** Quant ha crescut respecte de l'anterior, o res si no hi ha amb què comparar. */
function variacio(actual: number, anterior: number) {
  if (!anterior) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

function Xifra({ etiqueta, valor, respecte, destacat = false }: { etiqueta: string; valor: number; respecte?: number | null; destacat?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${destacat ? "border-wine/30 bg-white" : "border-line bg-white/60"}`}>
      <dt className="text-[12px] text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 font-display text-[20px] leading-tight tabular-nums">{euros(valor)}</dd>
      {respecte !== null && respecte !== undefined ? (
        <dd className={`mt-0.5 text-[11.5px] tabular-nums ${respecte >= 0 ? "text-emerald-700" : "text-wine-deep"}`}>
          {respecte >= 0 ? "+" : ""}
          {Math.round(respecte)}% respecte de l&apos;any anterior
        </dd>
      ) : null}
    </div>
  );
}

/**
 * La facturació d'un client: els dos exercicis sencers d'abans, i el que porta
 * l'any en curs fins al mes passat al costat del mateix tros dels anteriors.
 */
export function PanellFacturacio({ resum }: { resum: ResumFacturacio }) {
  const [menys2, menys1, actual] = resum.exercicis;
  const periode = resum.finsMes <= 0 ? null : resum.finsMes === 1 ? "gener" : `gener–${NOM_MES[resum.finsMes - 1]}`;

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Exercicis sencers</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <Xifra etiqueta={String(menys2.exercici)} valor={menys2.total} />
          <Xifra etiqueta={String(menys1.exercici)} valor={menys1.total} respecte={variacio(menys1.total, menys2.total)} />
        </dl>
      </section>

      <section>
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          {periode ? `Acumulat ${periode}` : `Acumulat de ${actual.exercici}`}
        </h3>
        {periode ? (
          <dl className="mt-2 grid gap-2 sm:grid-cols-3">
            <Xifra etiqueta={String(actual.exercici)} valor={actual.finsMes} respecte={variacio(actual.finsMes, menys1.finsMes)} destacat />
            <Xifra etiqueta={String(menys1.exercici)} valor={menys1.finsMes} respecte={variacio(menys1.finsMes, menys2.finsMes)} />
            <Xifra etiqueta={String(menys2.exercici)} valor={menys2.finsMes} />
          </dl>
        ) : (
          <p className="mt-2 text-[13px] text-muted">Encara no s&apos;ha tancat cap mes de {actual.exercici}.</p>
        )}
      </section>

      <p className="text-[12px] text-muted">
        Base imposable de les factures de FactuSol, sense IVA; les rectificatives resten. A {actual.exercici} s&apos;hi
        sumen els albarans encara no facturats. Es posa al dia amb la sincronització de clients.
      </p>
    </div>
  );
}
