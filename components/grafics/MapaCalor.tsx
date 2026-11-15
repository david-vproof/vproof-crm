import { etiquetaMes } from "@/domini/mesos";

type Cella = { mes: string; valor: number; intensitat: number };
type Fila = { nom: string; celles: Cella[] };

const euros = new Intl.NumberFormat("ca-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const explica = (nom: string, cella: Cella) =>
  `${nom} · ${etiquetaMes(cella.mes)}: ${euros.format(cella.valor)}`;

/** La intensitat es corba una mica perquè els valors baixos no desapareguin. */
const to = (intensitat: number) =>
  `rgba(15, 118, 110, ${0.06 + Math.pow(intensitat, 0.65) * 0.88})`;

/** Cada quants mesos es retola l'eix del mòbil: amb dotze etiquetes no s'hi cabria. */
const CADA = 3;

/**
 * Mapa de calor mes × categoria, en CSS: no cal cap mòdul extra de Highcharts.
 *
 * Té dues formes. A partir de tauleta, la graella de tota la vida: els noms a
 * l'esquerra i els mesos en columnes. Al telèfon, on dotze columnes i una
 * columna de noms no caben, cada categoria passa a ser una tira pròpia amb el
 * nom a sobre: així s'hi veu el mateix sense haver de rascar cap als costats.
 */
export function MapaCalor({ mesos, files }: { mesos: string[]; files: Fila[] }) {
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {/* L'eix, una sola vegada a dalt: retolat de tres en tres perquè s'hi llegeixi. */}
        <div
          className="grid gap-1 text-[10px] text-muted"
          style={{ gridTemplateColumns: `repeat(${mesos.length}, minmax(0,1fr))` }}
        >
          {mesos.map((mes, i) =>
            i % CADA === 0 ? (
              <span key={mes} className="col-span-3 truncate">
                {etiquetaMes(mes)}
              </span>
            ) : null,
          )}
        </div>

        {files.map((fila) => (
          <div key={fila.nom}>
            <p className="truncate text-[12.5px] text-ink">{fila.nom}</p>
            <div
              className="mt-1 grid gap-1"
              style={{ gridTemplateColumns: `repeat(${fila.celles.length}, minmax(0,1fr))` }}
            >
              {fila.celles.map((cella) => (
                <span
                  key={cella.mes}
                  title={explica(fila.nom, cella)}
                  className="h-7 rounded-[4px]"
                  style={{ backgroundColor: to(cella.intensitat) }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="hidden gap-1 text-[11px] text-muted sm:grid"
        style={{ gridTemplateColumns: `minmax(120px,1.2fr) repeat(${mesos.length}, minmax(0,1fr))` }}
      >
        <span />
        {mesos.map((mes) => (
          <span key={mes} className="pb-1 text-center">
            {etiquetaMes(mes).split(" ")[0]}
          </span>
        ))}

        {files.map((fila) => (
          <FilaCalor key={fila.nom} fila={fila} />
        ))}
      </div>
    </>
  );
}

function FilaCalor({ fila }: { fila: Fila }) {
  return (
    <>
      <span className="flex items-center truncate pr-2 text-[12.5px] text-ink">{fila.nom}</span>
      {fila.celles.map((cella) => (
        <span
          key={cella.mes}
          title={explica(fila.nom, cella)}
          className="h-7 rounded-[4px]"
          style={{ backgroundColor: to(cella.intensitat) }}
        />
      ))}
    </>
  );
}
