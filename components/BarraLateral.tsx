"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { tancaSessio } from "@/app/login/actions";
import { ModalCarregant, useNavegacioAmbEspera } from "@/components/CarregantPagina";
import { ICONES } from "@/components/Icones";
import { Marca } from "@/components/Marca";
import { GALETA_BARRA, SECCIONS, enllacActiu, partsDeLEnllac } from "@/lib/navegacio";
import { CLAU_VISTES, oblidaVistes } from "@/lib/vistes-recordades";

/** Només els mòduls en marxa, els d'administrador si ho és, els de qui ho veu tot si ho veu, i cap títol de secció orfe. */
function seccionsVisibles(administrador: boolean, veuTot: boolean) {
  return SECCIONS.map((seccio) => ({
    ...seccio,
    enllacos: seccio.enllacos.filter(
      (enllac) => enllac.actiu !== false && (administrador || !enllac.nomesAdministrador) && (veuTot || !enllac.nomesVeuTot),
    ),
  })).filter((seccio) => seccio.enllacos.length > 0);
}

/**
 * Qui té la sessió oberta, a dalt de tot del menú. El nom porta al propi
 * compte: és on s'espera trobar les dades personals.
 */
function Usuari({
  plegada, usuari, actiu, navega,
}: { plegada: boolean; usuari: string; actiu: boolean; navega: (e: MouseEvent<HTMLAnchorElement>, href: string) => void }) {
  return (
    <div className={`border-b border-white/[0.08] ${plegada ? "px-2 pb-3" : "px-3 pb-3"}`}>
      <Link
        href="/compte"
        onClick={(e) => navega(e, "/compte")}
        title={plegada ? `${usuari} · El meu compte` : undefined}
        aria-current={actiu ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-lg py-2 transition hover:bg-white/[0.04] ${
          plegada ? "justify-center" : "px-2"
        } ${actiu ? "bg-white/[0.07]" : ""}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-marca text-[13px] font-medium text-white">
          {usuari.slice(0, 1).toUpperCase()}
        </span>
        {plegada ? (
          <span className="sr-only">{usuari}</span>
        ) : (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13.5px] text-cream">{usuari}</span>
            <span className="block text-[11px] text-cream/40">Sessió oberta</span>
          </span>
        )}
      </Link>
    </div>
  );
}

/**
 * La llista del menú quan no hi cap sencera. La barra de scroll del sistema
 * s'amaga —sobre el fons fosc feia de pegat— i, pel costat on queda contingut
 * amagat, surt un degradat amb una fletxa que hi porta. Amb la roda o el dit
 * es desplaça igual que sempre.
 */
function LlistaDesplacable({ className, children }: { className: string; children: ReactNode }) {
  const llista = useRef<HTMLElement>(null);
  const [queda, setQueda] = useState({ amunt: false, avall: false });

  const mesura = useCallback(() => {
    const element = llista.current;
    if (!element) return;
    // Un píxel de marge: amb zoom, el final no sempre cau en un enter.
    const amunt = element.scrollTop > 1;
    const avall = element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    setQueda((previ) => (previ.amunt === amunt && previ.avall === avall ? previ : { amunt, avall }));
  }, []);

  useEffect(() => {
    const element = llista.current;
    if (!element) return;
    // En obrir, l'enllaç actiu ha de quedar a la vista encara que sigui a baix de tot.
    element.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
    mesura();
    const observador = new ResizeObserver(mesura);
    observador.observe(element);
    for (const fill of Array.from(element.children)) observador.observe(fill);
    return () => observador.disconnect();
  }, [mesura]);

  function desplaca(sentit: 1 | -1) {
    const element = llista.current;
    if (!element) return;
    const suau = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ top: sentit * element.clientHeight * 0.6, behavior: suau ? "smooth" : "auto" });
  }

  const Fletxa = ICONES.avall;
  const vora = (visible: boolean) =>
    `pointer-events-none absolute inset-x-0 z-10 flex h-11 justify-center from-ink via-ink/85 to-transparent transition-opacity duration-200 ${
      visible ? "opacity-100" : "opacity-0"
    }`;
  const boto =
    "pointer-events-auto grid size-6 place-items-center rounded-full bg-white/[0.07] text-cream/60 ring-1 ring-white/[0.06] backdrop-blur-sm transition hover:bg-white/[0.14] hover:text-cream";

  return (
    <div className="relative min-h-0 flex-1">
      <nav ref={llista} onScroll={mesura} className={`scroll-amagat h-full overflow-y-auto overscroll-contain ${className}`}>
        {children}
      </nav>

      <div className={`${vora(queda.amunt)} top-0 items-start bg-gradient-to-b pt-1`} aria-hidden={!queda.amunt}>
        <button
          type="button"
          tabIndex={queda.amunt ? 0 : -1}
          onClick={() => desplaca(-1)}
          aria-label="Desplaça el menú amunt"
          className={`${boto} ${queda.amunt ? "" : "!pointer-events-none"}`}
        >
          <Fletxa className="size-3.5 rotate-180" />
        </button>
      </div>
      <div className={`${vora(queda.avall)} bottom-0 items-end bg-gradient-to-t pb-1`} aria-hidden={!queda.avall}>
        <button
          type="button"
          tabIndex={queda.avall ? 0 : -1}
          onClick={() => desplaca(1)}
          aria-label="Desplaça el menú avall"
          className={`${boto} ${queda.avall ? "" : "!pointer-events-none"}`}
        >
          <Fletxa className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Paràmetres que no són filtres sinó on s'és dins la vista: la fitxa oberta, la
 * pestanya del panell, l'alta… i el mes o la setmana de l'agenda. No es recorden.
 */
const DE_PAS = ["r", "t", "pre", "esborrar", "nou", "f", "torna", "m", "s"];

function llegeixVistes(): Record<string, string> {
  try {
    const desat = JSON.parse(localStorage.getItem(CLAU_VISTES) ?? "{}");
    return desat && typeof desat === "object" ? desat : {};
  } catch {
    return {};
  }
}

/**
 * Els filtres de cada punt del menú, perquè en tornar-hi es trobin com es van
 * deixar. Cada visita a una vista hi deixa la seva adreça; si no té filtres,
 * l'esborra. Torna l'enllaç que ha de dur cada punt del menú.
 */
function useVistesRecordades(actiu: string | null, ruta: string, cerca: URLSearchParams) {
  const [vistes, setVistes] = useState<Record<string, string>>({});
  const consulta = cerca.toString();

  useEffect(() => {
    const desades = llegeixVistes();
    // Només a la llista mateixa: dins d'un client (/clients/123) no és la vista del menú.
    if (actiu && partsDeLEnllac(actiu).cami === ruta) {
      const params = new URLSearchParams(consulta);
      for (const clau of DE_PAS) params.delete(clau);
      const adreca = `${ruta}?${params}`;
      const neta = new URLSearchParams(partsDeLEnllac(actiu).params).toString();
      if (params.toString() === neta) delete desades[actiu];
      else desades[actiu] = adreca;
      try {
        localStorage.setItem(CLAU_VISTES, JSON.stringify(desades));
      } catch {
        // Sense emmagatzematge, el menú porta a les vistes sense filtres, com sempre.
      }
    }
    setVistes(desades);
  }, [actiu, ruta, consulta]);

  return (href: string) => vistes[href] ?? href;
}

/**
 * El menú en si, compartit per la barra de l'escriptori i el calaix del mòbil.
 * Plegat, només hi queden les icones; el nom surt com a rètol en passar-hi.
 */
function Menu({ plegada, usuari, administrador, veuTot }: { plegada: boolean; usuari: string; administrador: boolean; veuTot: boolean }) {
  const ruta = usePathname();
  // Les vistes del CRM es distingeixen pel paràmetre «v»: cal la consulta per
  // saber quin punt del menú és l'actiu.
  const cerca = useSearchParams();
  const Sortir = ICONES.sortir;
  const seccions = seccionsVisibles(administrador, veuTot);
  const actiu = enllacActiu(
    seccions.flatMap((seccio) => seccio.enllacos),
    ruta,
    cerca,
  );
  const enllacRecordat = useVistesRecordades(actiu, ruta, cerca);
  // Cada tria del menú ensenya el modal de càrrega fins que la pàgina nova és a la vista.
  const { pendent, navega } = useNavegacioAmbEspera();

  return (
    <>
      <ModalCarregant obert={pendent} />
      <Usuari plegada={plegada} usuari={usuari} actiu={actiu === "/compte"} navega={navega} />

      <LlistaDesplacable className={`py-2 ${plegada ? "space-y-3 px-2" : "space-y-6 px-3"}`}>
        {seccions.map((seccio, i) => (
          <div key={seccio.titol}>
            {plegada ? (
              i > 0 ? <div className="mx-2 mb-3 border-t border-white/[0.08]" /> : null
            ) : (
              <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-cream/30">
                {seccio.titol}
              </p>
            )}
            <ul className="space-y-0.5">
              {seccio.enllacos.map((enllac) => {
                const Icona = ICONES[enllac.icona];
                const esActiu = actiu === enllac.href;
                return (
                  <li key={enllac.href}>
                    <Link
                      href={enllacRecordat(enllac.href)}
                      onClick={(e) => navega(e, enllacRecordat(enllac.href))}
                      aria-current={esActiu ? "page" : undefined}
                      title={plegada ? enllac.etiqueta : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg py-2 text-[14px] transition ${
                        plegada ? "justify-center" : "px-3"
                      } ${esActiu ? "bg-white/[0.07] text-cream" : "text-cream/55 hover:bg-white/[0.04] hover:text-cream/90"}`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-marca transition-opacity ${
                          esActiu ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <Icona className="size-[18px] shrink-0" />
                      {plegada ? <span className="sr-only">{enllac.etiqueta}</span> : enllac.etiqueta}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </LlistaDesplacable>

      <div className={`border-t border-white/[0.08] ${plegada ? "p-2" : "p-3"}`}>
        {/* Sortir oblida els filtres recordats del menú: qui torni a entrar els trobarà nets. */}
        <form action={tancaSessio} onSubmit={oblidaVistes}>
          <button
            type="submit"
            title={plegada ? "Tanca la sessió" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg py-2 text-[14px] text-cream/55 transition hover:bg-white/[0.04] hover:text-cream ${
              plegada ? "justify-center" : "px-3"
            }`}
          >
            <Sortir className="size-[18px] shrink-0" />
            {plegada ? <span className="sr-only">Tanca la sessió</span> : "Tanca la sessió"}
          </button>
        </form>
      </div>
    </>
  );
}

/** La barra de l'escriptori. Es pot plegar a una columna d'icones, i se'n recorda. */
export function BarraLateral({
  usuari,
  administrador = false,
  veuTot = false,
  plegadaInicial = false,
}: {
  usuari: string;
  administrador?: boolean;
  /** Si veu els clients de tothom: només llavors surten l'ERP i la Configuració. */
  veuTot?: boolean;
  plegadaInicial?: boolean;
}) {
  const [plegada, setPlegada] = useState(plegadaInicial);
  const Plegar = ICONES.plegar;
  const Desplegar = ICONES.desplegar;

  function commuta() {
    const nova = !plegada;
    setPlegada(nova);
    // La galeta la llegeix el layout del servidor per pintar-la ja plegada.
    document.cookie = `${GALETA_BARRA}=${nova ? "plegada" : ""}; path=/; max-age=${nova ? 60 * 60 * 24 * 365 : 0}; samesite=lax`;
  }

  return (
    <aside
      className={`hidden shrink-0 flex-col bg-ink transition-[width] duration-200 lg:flex ${plegada ? "w-[68px]" : "w-[264px]"}`}
    >
      <div className={`flex items-center py-6 ${plegada ? "flex-col gap-3 px-2" : "justify-between gap-2 px-5"}`}>
        <Marca clar compacta={plegada} />
        <button
          type="button"
          onClick={commuta}
          aria-expanded={!plegada}
          aria-label={plegada ? "Mostra el menú" : "Amaga el menú"}
          title={plegada ? "Mostra el menú" : "Amaga el menú"}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-cream/50 transition hover:bg-white/[0.06] hover:text-cream"
        >
          {plegada ? <Desplegar className="size-[18px]" /> : <Plegar className="size-[18px]" />}
        </button>
      </div>

      <Menu plegada={plegada} usuari={usuari} administrador={administrador} veuTot={veuTot} />
    </aside>
  );
}

/** Al mòbil: capçalera amb l'hamburguesa a l'esquerra, que obre el mateix menú en un calaix. */
export function BarraSuperiorMobil({
  usuari, administrador = false, veuTot = false,
}: { usuari: string; administrador?: boolean; veuTot?: boolean }) {
  const ruta = usePathname();
  // Es desa des de quina ruta s'ha obert: navegar canvia la ruta i el calaix es tanca sol.
  const [obertA, setObertA] = useState<string | null>(null);
  const obert = obertA === ruta;
  const MenuIcona = ICONES.menu;
  const Tancar = ICONES.tancar;
  const Sortir = ICONES.sortir;

  useEffect(() => {
    if (!obert) return;
    const ambEscape = (e: KeyboardEvent) => e.key === "Escape" && setObertA(null);
    document.addEventListener("keydown", ambEscape);
    return () => document.removeEventListener("keydown", ambEscape);
  }, [obert]);

  return (
    <>
      {/* Fons ple i sense desenfocament: sota la capçalera no hi passa res (el que es desplaça és el <main>), i un
          backdrop-filter obliga a repintar la pantalla sencera en desplaçar un panell, que als iPhone parpelleja. */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-cream px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setObertA(ruta)}
            aria-label="Obre el menú"
            aria-expanded={obert}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition hover:text-ink"
          >
            <MenuIcona className="size-[18px]" />
          </button>
          <Marca />
        </div>
        <form action={tancaSessio} onSubmit={oblidaVistes}>
          <button
            type="submit"
            aria-label={`Tanca la sessió de ${usuari}`}
            className="grid size-9 place-items-center rounded-lg border border-line bg-white text-muted transition hover:text-ink"
          >
            <Sortir className="size-[18px]" />
          </button>
        </form>
      </header>

      {obert ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tanca el menú"
            onClick={() => setObertA(null)}
            className="absolute inset-0 bg-ink/45"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-ink shadow-2xl">
            <div className="flex items-center justify-between gap-2 px-5 py-6">
              <Marca clar />
              <button
                type="button"
                onClick={() => setObertA(null)}
                aria-label="Tanca el menú"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-cream/50 transition hover:bg-white/[0.06] hover:text-cream"
              >
                <Tancar className="size-[18px]" />
              </button>
            </div>
            <Menu plegada={false} usuari={usuari} administrador={administrador} veuTot={veuTot} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
