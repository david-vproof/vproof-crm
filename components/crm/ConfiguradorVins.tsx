"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ModalAgendaDies } from "@/components/crm/ModalAgendaDies";
import { BotoFullaVins } from "@/components/crm/BotoFullaVins";
import { ModalLeads } from "@/components/crm/ModalLeads";
import { ModalClients } from "@/components/crm/SelectorClients";
import { FotoArticle } from "@/components/FotoArticle";
import { ICONES } from "@/components/Icones";
import { CARACTERISTIQUES } from "@/domini/cataleg-articles";
import {
  CRITERIS_BUITS, FILTRES_COMPRA, FILTRES_TAST, MAXIM_VINS_PER_ACTIVITAT, MAXIM_VINS_PER_PLANTILLA, afegeixALaCistella,
  cistellaDePlantilla, commutaValor, esTriat, filtraVins, liniesPerDesar, opcionsDeCriteris, passaFiltrePerClients,
  quantsCriteris, resumPerClients, treuDeLaCistella, viVisible, type ClientOLead as ClientTriat, type Compres, type CriterisVins, type FiltrePerClients, type LiniaCistella,
  type OpcioPerClients, type Plantilla, type ResumPlantilla, type Tast, type Tastos, type ViDeCataleg,
} from "@/domini/cistella-vins";
import { FILTRES_ESTOC, passaFiltreEstoc, type EstocVi, type Estocs, type FiltreEstoc } from "@/domini/estoc-vins";
import { FILTRE_PREU_BUIT, filtrePreuActiu, passaFiltrePreu, type FiltrePreu, type Preus } from "@/domini/preus-vins";
import { dataCurta, eurosAmbCentims, quantitat } from "@/lib/format";

/** Quants vins es pinten com a molt a la llista de resultats: més, i cal afinar els criteris. */
const MAXIM_ENSENYATS = 300;

/** Fins a quants vins trobats es poden afegir d'un cop a la cistella. */
const MAXIM_AFEGIR_DE_COP = 100;

/** L'ordre de la llista de resultats: el del catàleg, o per preu de venda al major. */
type OrdreVins = "cataleg" | "preu-asc" | "preu-desc";
const ORDRES: { valor: OrdreVins; etiqueta: string }[] = [
  { valor: "cataleg", etiqueta: "Per nom" },
  { valor: "preu-asc", etiqueta: "Preu, de menys a més" },
  { valor: "preu-desc", etiqueta: "Preu, de més a menys" },
];

/** Per preu, i a igual preu per l'ordre que ja duien. Els vins sense preu a la tarifa van al final. */
function ordenaPerPreu(vins: ViDeCataleg[], preus: Preus, descendent: boolean) {
  const preuDe = (vi: ViDeCataleg) => preus[vi.id];
  return [...vins].sort((a, b) => {
    const pa = preuDe(a);
    const pb = preuDe(b);
    if (pa === undefined || pb === undefined) return pa === undefined ? (pb === undefined ? 0 : 1) : -1;
    return descendent ? pb - pa : pa - pb;
  });
}

async function demana<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const resposta = await fetch(ruta, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const cos = (await resposta.json().catch(() => ({}))) as T & { error?: string };
  if (!resposta.ok) throw new Error(cos.error ?? `El servidor ha respost ${resposta.status}.`);
  return cos;
}

type Carregada = { id: string; nom: string; descripcio: string };

/**
 * El que s'ha triat al selector: el que la pàgina recorda quan se'n surt i s'hi
 * torna (vegeu `SelectorVinsRecordat`). El que ve en viu (l'estoc, els preus, els
 * tastos i les compres dels clients) no hi és: es torna a llegir en muntar-se.
 */
export type TriaDelSelector = {
  criteris: CriterisVins;
  linies: LiniaCistella[];
  carregada: Carregada | null;
  clients: ClientTriat[];
  filtreTast: FiltrePerClients;
  filtreCompra: FiltrePerClients;
  diaVisita: string;
  activitatsDelDia: { id: string; client: string }[];
  filtreEstoc: FiltreEstoc;
  filtrePreu: FiltrePreu;
  ordre: OrdreVins;
};

/**
 * El configurador de vins: una cistella que s'omple del catàleg amb criteris
 * de selecció (les característiques dels vins: tipus, varietat, productor,
 * anyada, regió, zona, format i proveïdor), i que es desa com a plantilla per
 * tornar-la a fer servir.
 *
 * Té tres parts: els criteris, els vins que els compleixen, i la cistella. A
 * l'escriptori van en tres columnes; al telèfon, els criteris i la cistella es
 * pleguen darrere d'un botó cada un, perquè no hi cap tot.
 *
 * Es poden triar un o més clients (o un segment sencer, amb el modal de
 * clients del CRM, o tots els d'un dia de visita de l'agenda) i també leads:
 * llavors cada vi diu si ja l'han tastat o comprat, qui i quan, i entre els
 * criteris n'hi ha dos que només valen amb algú triat: tastat i comprat (cap,
 * algun, tots). Sense ningú, surten en gris. Un lead no té compres, i el que
 * ha tastat passa al client quan s'hi converteix.
 *
 * Els vins històrics, que ja no es venen, no surten si no es marca «Històrics»,
 * llevat dels que algú dels triats ha tastat o comprat.
 *
 * Quan els clients vénen d'un dia de visita, la cistella es pot posar a les
 * activitats d'aquell dia: a cada visita dels clients triats s'hi afegeixen
 * els vins que no tingués. Amb clients triats a mà no hi ha cap activitat on
 * posar-los, i el botó no surt.
 *
 * L'estoc ve de FactuSol en viu, a part del catàleg: cada vi diu quant n'hi
 * ha disponible (i l'actual, desglossat per magatzem, en tocar la marca), i
 * hi ha un criteri per quedar-se només amb els que en tenen o amb els que no.
 * Si l'ERP no respon, el selector va igual, sense estoc, i ho diu.
 *
 * Viu a la pàgina «Selector de vins» i, en modal, dins del formulari d'una
 * activitat: llavors `alAplicar` torna els vins triats al camp de l'activitat.
 * Com que pot anar dins d'un formulari, cap botó envia i cap camp porta `name`.
 */
export function ConfiguradorVins({
  catalegInicial = null,
  inicials = [],
  clientsInicials = [],
  alAplicar,
  recordada = null,
  alCanviarTria,
}: {
  /** El catàleg ja llegit al servidor (la pàgina). Sense, es demana en muntar-se (el modal). */
  catalegInicial?: ViDeCataleg[] | null;
  /** Els vins que ja hi ha a l'activitat: la cistella comença amb ells. */
  inicials?: string[];
  /** El client o lead que es visita (el de l'activitat): es comença amb ell triat, i es pot canviar. */
  clientsInicials?: ClientTriat[];
  /** En modal: el botó «Aplica» torna els vins de la cistella a qui l'ha obert. */
  alAplicar?: (vins: ViDeCataleg[]) => void;
  /** A la pàgina: la tria amb què es va deixar, per començar-hi. */
  recordada?: TriaDelSelector | null;
  /** A la pàgina: cada canvi de la tria, per recordar-la. Ha de ser una funció estable. */
  alCanviarTria?: (tria: TriaDelSelector) => void;
}) {
  const [actius, setCataleg] = useState<ViDeCataleg[] | null>(catalegInicial);
  const [errorCataleg, setErrorCataleg] = useState("");
  /** Els vins que ja no es venen: milers, i es demanen només quan algú marca «Històrics» (o ja en té a la cistella). */
  const [historics, setHistorics] = useState<ViDeCataleg[] | null>(null);
  const peticioHistorics = useRef<Promise<ViDeCataleg[]> | null>(null);
  /** Els històrics que els clients triats han tastat o comprat: arriben amb els tastos i les compres. */
  const [historicsDelsClients, setHistoricsDelsClients] = useState<ViDeCataleg[]>([]);
  const [criteris, setCriteris] = useState<CriterisVins>(recordada?.criteris ?? CRITERIS_BUITS);
  const [linies, setLinies] = useState<LiniaCistella[]>(recordada?.linies ?? []);
  const [plantilles, setPlantilles] = useState<ResumPlantilla[]>([]);
  const [carregada, setCarregada] = useState<Carregada | null>(recordada?.carregada ?? null);
  const [avis, setAvis] = useState("");
  const [missatge, setMissatge] = useState("");
  const [ocupat, setOcupat] = useState(false);
  const [panellMobil, setPanellMobil] = useState<"criteris" | "cistella" | null>(null);
  const [desant, setDesant] = useState<{ nom: string; descripcio: string } | null>(null);
  const [confirmaEsborrar, setConfirmaEsborrar] = useState(false);
  /** Els clients i els leads triats, junts: per als criteris i les marques, tant és. */
  const [clients, setClients] = useState<ClientTriat[]>(recordada?.clients ?? clientsInicials);
  const nomesClients = useMemo(() => clients.filter((client) => !client.lead), [clients]);
  const nomesLeads = useMemo(() => clients.filter((client) => client.lead), [clients]);
  const [modalClients, setModalClients] = useState(false);
  const [modalLeads, setModalLeads] = useState(false);
  const [tastos, setTastos] = useState<Tastos>({});
  const [compres, setCompres] = useState<Compres>({});
  const [carregantTastos, setCarregantTastos] = useState(false);
  const [filtreTast, setFiltreTast] = useState<FiltrePerClients>(recordada?.filtreTast ?? "tots");
  const [filtreCompra, setFiltreCompra] = useState<FiltrePerClients>(recordada?.filtreCompra ?? "tots");
  const [diaVisita, setDiaVisita] = useState(recordada?.diaVisita ?? "");
  /** Les activitats amb client del dia triat: a elles van els vins de la cistella. */
  const [activitatsDelDia, setActivitatsDelDia] = useState<{ id: string; client: string }[]>(recordada?.activitatsDelDia ?? []);
  const [confirmaVisites, setConfirmaVisites] = useState(false);
  const [posantALesVisites, setPosantALesVisites] = useState(false);
  const [modalAgenda, setModalAgenda] = useState(false);
  /** Puja cada cop que es tria un dia: tornar a triar el mateix també rellegeix l'agenda. */
  const [tandaDia, setTandaDia] = useState(0);
  const [carregantDia, setCarregantDia] = useState(false);
  const [estocs, setEstocs] = useState<Estocs | null>(null);
  const [errorEstoc, setErrorEstoc] = useState("");
  const [filtreEstoc, setFiltreEstoc] = useState<FiltreEstoc>(recordada?.filtreEstoc ?? "tots");
  // El preu de venda al major, en viu de FactuSol, com l'estoc.
  const [preus, setPreus] = useState<Preus | null>(null);
  const [tarifa, setTarifa] = useState("");
  const [errorPreus, setErrorPreus] = useState("");
  const [filtrePreu, setFiltrePreu] = useState<FiltrePreu>(recordada?.filtrePreu ?? FILTRE_PREU_BUIT);
  /** L'ordre de la llista: el del catàleg (per nom) o per preu. Només té sentit amb els preus llegits. */
  const [ordre, setOrdre] = useState<OrdreVins>(recordada?.ordre ?? "cataleg");

  // La tria, a qui la vulgui recordar.
  useEffect(() => {
    alCanviarTria?.({ criteris, linies, carregada, clients, filtreTast, filtreCompra, diaVisita, activitatsDelDia, filtreEstoc, filtrePreu, ordre });
  }, [alCanviarTria, criteris, linies, carregada, clients, filtreTast, filtreCompra, diaVisita, activitatsDelDia, filtreEstoc, filtrePreu, ordre]);

  // El catàleg, si no ha vingut del servidor.
  useEffect(() => {
    if (actius) return;
    let viu = true;
    demana<{ vins: ViDeCataleg[] }>("/api/crm/cataleg-vins")
      .then((cos) => viu && setCataleg(cos.vins))
      .catch((error: Error) => viu && setErrorCataleg(error.message));
    return () => {
      viu = false;
    };
  }, [actius]);

  /** Demana els històrics un sol cop. Si falla, queden buits: la llista no s'encalla esperant-los. */
  function demanaHistorics() {
    peticioHistorics.current ??= demana<{ vins: ViDeCataleg[] }>("/api/crm/cataleg-vins?historics=1")
      .then((cos) => {
        setHistorics(cos.vins);
        return cos.vins;
      })
      .catch((error: Error) => {
        setHistorics([]);
        setAvis(`No s'han pogut llegir els vins històrics: ${error.message}`);
        return [];
      });
    return peticioHistorics.current;
  }

  // Els històrics no es recorden, que són milers: si es torna amb la casella marcada, es tornen a demanar.
  useEffect(() => {
    if (criteris.ambHistorics) void demanaHistorics();
  }, [criteris.ambHistorics]);

  /** Tot el que es coneix, sense repetir: els actius, els dels clients i, si s'han demanat, tots els històrics. Les marques i la cistella hi busquen. */
  const cataleg = useMemo(() => {
    if (!actius) return null;
    const perId = new Map([...actius, ...(historics ?? []), ...historicsDelsClients].map((vi) => [vi.id, vi]));
    return [...perId.values()];
  }, [actius, historics, historicsDelsClients]);
  /** El que es pot ensenyar ara: els històrics, només si es demanen o si són dels clients triats. */
  const catalegVisible = useMemo(
    () => cataleg?.filter((vi) => viVisible(vi, criteris.ambHistorics, tastos, compres)) ?? null,
    [cataleg, criteris.ambHistorics, tastos, compres],
  );

  // L'estoc, en viu de FactuSol. Va a part: si l'ERP triga o falla, el catàleg ja és a la pantalla.
  useEffect(() => {
    let viu = true;
    demana<{ estocs: Estocs }>("/api/crm/estoc-vins")
      .then((cos) => viu && setEstocs(cos.estocs))
      .catch((error: Error) => viu && setErrorEstoc(error.message));
    demana<{ preus: Preus; tarifa: string }>("/api/crm/preus-vins")
      .then((cos) => {
        if (!viu) return;
        setPreus(cos.preus);
        setTarifa(cos.tarifa);
      })
      .catch((error: Error) => viu && setErrorPreus(error.message));
    return () => {
      viu = false;
    };
  }, []);

  // La cistella comença amb els vins que ja té l'activitat. Si algun no és
  // entre els actius (un vi que ja no es ven), es demanen els històrics abans
  // d'omplir-la: si no, en aplicar es perdria. Es fa un sol cop.
  const idsInicials = inicials.join(",");
  const cistellaIniciada = useRef(false);
  useEffect(() => {
    if (!cataleg || !idsInicials || cistellaIniciada.current) return;
    const ids = new Set(idsInicials.split(","));
    const trobats = cataleg.filter((vi) => ids.has(vi.id));
    if (trobats.length < ids.size && !historics) {
      demanaHistorics();
      return;
    }
    cistellaIniciada.current = true;
    setLinies(trobats.map((vi) => ({ vi })));
  }, [cataleg, historics, idsInicials]);

  // Què han tastat i comprat els clients i els leads triats: cada cop que canvien.
  const idsClients = nomesClients.map((client) => client.id).join(",");
  const idsLeads = nomesLeads.map((lead) => lead.id).join(",");
  useEffect(() => {
    if (!idsClients && !idsLeads) {
      setTastos({});
      setCompres({});
      setHistoricsDelsClients([]);
      setFiltreTast("tots");
      setFiltreCompra("tots");
      return;
    }
    let viu = true;
    setCarregantTastos(true);
    demana<{ tastos: Tastos; compres: Compres; historics: ViDeCataleg[] }>(`/api/crm/vins-dels-clients?clients=${encodeURIComponent(idsClients)}&leads=${encodeURIComponent(idsLeads)}`)
      .then((cos) => {
        if (!viu) return;
        setTastos(cos.tastos);
        setCompres(cos.compres);
        setHistoricsDelsClients(cos.historics);
      })
      .catch((error: Error) => viu && setAvis(`No s'ha pogut saber què han tastat ni comprat: ${error.message}`))
      .finally(() => viu && setCarregantTastos(false));
    return () => {
      viu = false;
    };
  }, [idsClients, idsLeads]);

  // Els clients i leads d'un dia de visita de l'agenda: substitueixen la tria.
  // Tornant a la pàgina (`tandaDia` a zero: el dia és el recordat, no se n'acaba
  // de triar cap) la tria es respecta, que potser se n'han tret: només es
  // rellegeixen les activitats, que a l'agenda poden haver canviat mentrestant.
  useEffect(() => {
    if (!diaVisita) return;
    let viu = true;
    const diaAcabatDeTriar = tandaDia > 0;
    if (diaAcabatDeTriar) setCarregantDia(true);
    demana<{ clients: ClientTriat[]; activitats: { id: string; client: string }[]; senseClient: number }>(
      `/api/crm/clients-del-dia?dia=${diaVisita}`,
    )
      .then((cos) => {
        if (!viu) return;
        setActivitatsDelDia(cos.activitats);
        if (!diaAcabatDeTriar) return;
        setClients(cos.clients);
        setConfirmaVisites(false);
        const leads = cos.clients.filter((client) => client.lead).length;
        const quants = cos.clients.length - leads;
        const qui = [
          quants > 0 ? `${quants} ${quants === 1 ? "client" : "clients"}` : "",
          leads > 0 ? `${leads} ${leads === 1 ? "lead" : "leads"}` : "",
        ].filter(Boolean).join(" i ");
        const fora = cos.senseClient > 0 ? ` (${cos.senseClient} ${cos.senseClient === 1 ? "activitat" : "activitats"} sense client ni lead, no hi entren)` : "";
        setMissatge(
          qui ? `${qui} de les visites del ${dataCurta(diaVisita)}${fora}.` : `Cap visita amb client o lead el ${dataCurta(diaVisita)}${fora}.`,
        );
        setAvis("");
      })
      .catch((error: Error) => viu && setAvis(`No s'han pogut llegir les visites del dia: ${error.message}`))
      .finally(() => viu && setCarregantDia(false));
    return () => {
      viu = false;
    };
  }, [diaVisita, tandaDia]);

  const llegeixPlantilles = () =>
    demana<{ plantilles: ResumPlantilla[] }>("/api/crm/plantilles-vins")
      .then((cos) => setPlantilles(cos.plantilles))
      .catch(() => setPlantilles([]));

  useEffect(() => {
    void llegeixPlantilles();
  }, []);

  const filtratsSenseOrdre = useMemo(
    () =>
      catalegVisible
        ? filtraVins(catalegVisible, criteris).filter(
            (vi) =>
              passaFiltrePerClients(vi, tastos, clients.length, filtreTast) &&
              passaFiltrePerClients(vi, compres, clients.length, filtreCompra) &&
              passaFiltreEstoc(vi.id, estocs, filtreEstoc) &&
              passaFiltrePreu(vi.id, preus, filtrePreu),
          )
        : [],
    [catalegVisible, criteris, tastos, compres, clients.length, filtreTast, filtreCompra, estocs, filtreEstoc, preus, filtrePreu],
  );
  // Ordenats per preu si es demana: els que no en tenen, al final. Si no, l'ordre del catàleg.
  const trobats = useMemo(
    () => (ordre === "cataleg" || !preus ? filtratsSenseOrdre : ordenaPerPreu(filtratsSenseOrdre, preus, ordre === "preu-desc")),
    [filtratsSenseOrdre, preus, ordre],
  );
  const opcions = useMemo(() => (catalegVisible ? opcionsDeCriteris(catalegVisible, criteris) : {}), [catalegVisible, criteris]);
  const enCistella = useMemo(() => new Set(linies.map((linia) => linia.vi.id)), [linies]);
  const posats =
    quantsCriteris(criteris) +
    (criteris.cerca.trim() ? 1 : 0) +
    (clients.length > 0 ? (filtreTast !== "tots" ? 1 : 0) + (filtreCompra !== "tots" ? 1 : 0) : 0) +
    (estocs && filtreEstoc !== "tots" ? 1 : 0) +
    (preus && filtrePreuActiu(filtrePreu) ? 1 : 0);
  const ambEstoc = estocs ? trobats.filter((vi) => (estocs[vi.id]?.disponible ?? 0) > 0).length : 0;

  function avisa(text: string) {
    setMissatge(text);
    setAvis("");
  }

  async function carrega(id: string) {
    if (!id || !cataleg) return;
    setOcupat(true);
    try {
      const { plantilla } = await demana<{ plantilla: Plantilla }>(`/api/crm/plantilles-vins/${id}`);
      // Un vi que no és entre els coneguts pot ser un històric: es mira abans de dir que ja no és al catàleg.
      const coneguts = new Set(cataleg.map((vi) => vi.id));
      const falten = plantilla.linies.some((linia) => linia.article && !coneguts.has(linia.article));
      const cistella = cistellaDePlantilla(plantilla.linies, falten ? [...cataleg, ...(await demanaHistorics())] : cataleg);
      setLinies(cistella.linies);
      setCriteris(plantilla.criteris);
      if (plantilla.criteris.ambHistorics) demanaHistorics();
      setCarregada({ id: plantilla.id, nom: plantilla.nom, descripcio: plantilla.descripcio });
      setDesant(null);
      setConfirmaEsborrar(false);
      setMissatge(`Plantilla «${plantilla.nom}» carregada.`);
      setAvis(
        cistella.perduts.length > 0
          ? `${cistella.perduts.length === 1 ? "Un vi de la plantilla ja no és" : `${cistella.perduts.length} vins de la plantilla ja no són`} al catàleg: ${cistella.perduts.join(", ")}.`
          : "",
      );
    } catch (error) {
      avisa(`No s'ha pogut carregar: ${(error as Error).message}`);
    } finally {
      setOcupat(false);
    }
  }

  async function desa(comANova: boolean) {
    if (!desant) return;
    const cos = { nom: desant.nom, descripcio: desant.descripcio, criteris, linies: liniesPerDesar(linies) };
    setOcupat(true);
    try {
      // La llista es refresca abans de dir-ho: així el desplegable ja la porta quan surt el missatge.
      if (comANova || !carregada) {
        const { id } = await demana<{ id: string }>("/api/crm/plantilles-vins", { method: "POST", body: JSON.stringify(cos) });
        await llegeixPlantilles();
        setCarregada({ id, nom: cos.nom, descripcio: cos.descripcio });
        avisa(`Plantilla «${cos.nom}» desada.`);
      } else {
        await demana(`/api/crm/plantilles-vins/${carregada.id}`, { method: "PUT", body: JSON.stringify(cos) });
        await llegeixPlantilles();
        setCarregada({ ...carregada, nom: cos.nom, descripcio: cos.descripcio });
        avisa(`Plantilla «${cos.nom}» actualitzada.`);
      }
      setDesant(null);
    } catch (error) {
      avisa(`No s'ha pogut desar: ${(error as Error).message}`);
    } finally {
      setOcupat(false);
    }
  }

  async function esborra() {
    if (!carregada) return;
    setOcupat(true);
    try {
      await demana(`/api/crm/plantilles-vins/${carregada.id}`, { method: "DELETE" });
      avisa(`Plantilla «${carregada.nom}» esborrada. La cistella es queda tal com és.`);
      setCarregada(null);
      setConfirmaEsborrar(false);
      await llegeixPlantilles();
    } catch (error) {
      avisa(`No s'ha pogut esborrar: ${(error as Error).message}`);
    } finally {
      setOcupat(false);
    }
  }

  function buida() {
    setLinies([]);
    setCarregada(null);
    setDesant(null);
    setConfirmaEsborrar(false);
    avisa("");
  }

  /** «Nova plantilla» al desplegable: es deixa la carregada i es comença de zero, cistella i criteris buits. */
  function nova() {
    buida();
    setCriteris(CRITERIS_BUITS);
    avisa("Plantilla nova: la cistella i els criteris comencen buits. Quan la tinguis, «Desa com a plantilla».");
  }

  function afegeixTrobats() {
    let noves = linies;
    for (const vi of trobats) {
      if (noves.length >= MAXIM_VINS_PER_PLANTILLA) break;
      if (!enCistella.has(vi.id)) noves = afegeixALaCistella(noves, vi);
    }
    setLinies(noves);
    avisa(`${trobats.length} ${trobats.length === 1 ? "vi afegit" : "vins afegits"} a la cistella.`);
  }

  /** Les visites del dia triat que són d'un client que encara és a la tria: a aquestes van els vins. */
  const visitesPerPosar = useMemo(() => {
    if (!diaVisita) return 0;
    const triats = new Set(clients.map((client) => client.id));
    return activitatsDelDia.filter((activitat) => triats.has(activitat.client)).length;
  }, [diaVisita, activitatsDelDia, clients]);

  async function posaALesVisites() {
    if (!diaVisita || linies.length === 0) return;
    setOcupat(true);
    setPosantALesVisites(true);
    try {
      const resultat = await demana<{ activitats: number; afegits: number; plenes: number }>("/api/crm/activitats/vins", {
        method: "POST",
        body: JSON.stringify({ dia: diaVisita, clients: clients.map((client) => client.id), articles: linies.map((linia) => linia.vi.id) }),
      });
      const visites = `${resultat.activitats} ${resultat.activitats === 1 ? "visita" : "visites"} del ${dataCurta(diaVisita)}`;
      if (resultat.activitats === 0) {
        avisa(`Cap visita del ${dataCurta(diaVisita)} és dels clients triats: no s'ha posat cap vi.`);
      } else if (resultat.afegits === 0) {
        avisa(`Les ${visites} ja tenien tots els vins de la cistella.`);
      } else {
        avisa(`${resultat.afegits} ${resultat.afegits === 1 ? "vi posat" : "vins posats"} a ${visites}.`);
      }
      setAvis(
        resultat.plenes > 0
          ? `${resultat.plenes === 1 ? "Una visita ja anava plena" : `${resultat.plenes} visites ja anaven plenes`}: una activitat porta com a molt ${MAXIM_VINS_PER_ACTIVITAT} vins, i no hi han cabut tots.`
          : "",
      );
      setConfirmaVisites(false);
    } catch (error) {
      avisa(`No s'han pogut posar els vins a les visites: ${(error as Error).message}`);
    } finally {
      setOcupat(false);
      setPosantALesVisites(false);
    }
  }

  const Cerca = ICONES.cerca;
  const Tancar = ICONES.tancar;
  const Clients = ICONES.clients;
  const Agenda = ICONES.planner;

  const marcaDeTast = (vi: ViDeCataleg) => <MarcaPerClients vi={vi} perVi={tastos} clients={clients} participi="Tastat" to="vi" />;
  const marcaDeCompra = (vi: ViDeCataleg) => <MarcaPerClients vi={vi} perVi={compres} clients={clients} participi="Comprat" to="verd" />;
  const marcaDEstoc = (vi: ViDeCataleg) => (estocs ? <MarcaEstoc estoc={estocs[vi.id] ?? null} /> : null);
  const marcaDePreu = (vi: ViDeCataleg) => (preus ? <MarcaPreu preu={preus[vi.id] ?? null} tarifa={tarifa} /> : null);

  /** El criteri de preu: entre dos imports de la tarifa de venda al major. Mentre els preus no han arribat, o si no arriben, en gris. */
  const criteriPreu = (() => {
    const sensePreus = !preus;
    const camp = (clau: "minim" | "maxim", etiqueta: string) => (
      <label className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted">
        {etiqueta}
        <input
          type="text"
          inputMode="decimal"
          value={filtrePreu[clau]}
          onChange={(e) => setFiltrePreu({ ...filtrePreu, [clau]: e.target.value })}
          placeholder={clau === "minim" ? "0" : "∞"}
          aria-label={`Preu ${etiqueta === "de" ? "mínim" : "màxim"}, en euros`}
          className="field-compacte !w-[4.5rem] !px-2 !py-1 text-right tabular-nums text-ink"
        />
        €
      </label>
    );
    return (
      <fieldset
        disabled={sensePreus}
        className={`rounded-lg border border-line bg-white ${sensePreus ? "opacity-50" : ""}`}
        aria-describedby={sensePreus ? "preu-ajuda" : undefined}
      >
        <legend className="sr-only">Preu</legend>
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px] font-medium">
          <span className="flex items-center gap-2">
            Preu
            {!sensePreus && filtrePreuActiu(filtrePreu) ? <span className="rounded-full bg-wine px-1.5 py-px text-[10.5px] font-semibold text-cream">1</span> : null}
          </span>
          <span className="text-[11px] font-normal text-muted">{errorPreus ? "no disponible" : sensePreus ? "llegint…" : null}</span>
        </div>
        <div className="flex items-center gap-3 border-t border-line px-3 py-2">
          {camp("minim", "de")}
          {camp("maxim", "a")}
          {filtrePreuActiu(filtrePreu) ? (
            <button type="button" onClick={() => setFiltrePreu(FILTRE_PREU_BUIT)} aria-label="Treu el criteri de preu" className="text-[12px] text-wine hover:underline">
              Treu
            </button>
          ) : null}
        </div>
        {sensePreus ? (
          <p id="preu-ajuda" className="border-t border-line px-3 py-1.5 text-[11.5px] text-muted">
            {errorPreus ? `No s'han pogut llegir els preus de FactuSol: ${errorPreus}` : "Llegint els preus de FactuSol…"}
          </p>
        ) : null}
      </fieldset>
    );
  })();

  /** El criteri d'estoc: una llista d'opcions excloents. Mentre l'estoc no ha arribat, o si no arriba, en gris. */
  const criteriEstoc = (() => {
    const senseEstoc = !estocs;
    return (
      <fieldset
        disabled={senseEstoc}
        className={`rounded-lg border border-line bg-white ${senseEstoc ? "opacity-50" : ""}`}
        aria-describedby={senseEstoc ? "estoc-ajuda" : undefined}
      >
        <legend className="sr-only">Estoc</legend>
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px] font-medium">
          <span className="flex items-center gap-2">
            Estoc
            {!senseEstoc && filtreEstoc !== "tots" ? <span className="rounded-full bg-wine px-1.5 py-px text-[10.5px] font-semibold text-cream">1</span> : null}
          </span>
          <span className="text-[11px] font-normal text-muted">{errorEstoc ? "no disponible" : senseEstoc ? "llegint…" : "de FactuSol, ara"}</span>
        </div>
        <ul className="border-t border-line px-1.5 py-1">
          {FILTRES_ESTOC.map((opcio) => (
            <li key={opcio.valor}>
              <label className={`flex items-center gap-2 rounded px-1.5 py-1 text-[13px] ${senseEstoc ? "cursor-not-allowed" : "cursor-pointer transition hover:bg-parchment/60"}`}>
                <input
                  type="radio"
                  name="criteri-estoc"
                  value={opcio.valor}
                  checked={senseEstoc ? opcio.valor === "tots" : filtreEstoc === opcio.valor}
                  onChange={() => setFiltreEstoc(opcio.valor)}
                  className="size-3.5 shrink-0 accent-wine"
                />
                <span className="min-w-0 flex-1">{opcio.etiqueta}</span>
              </label>
            </li>
          ))}
        </ul>
        {senseEstoc ? (
          <p id="estoc-ajuda" className="border-t border-line px-3 py-1.5 text-[11.5px] text-muted">
            {errorEstoc ? `No s'ha pogut llegir l'estoc de FactuSol: ${errorEstoc}` : "Llegint l'estoc de FactuSol…"}
          </p>
        ) : null}
      </fieldset>
    );
  })();

  /** Un criteri respecte als clients triats: una llista d'opcions excloents. Sense clients, en gris. */
  const criteriPerClients = (
    titol: string,
    nom: string,
    opcions: OpcioPerClients[],
    valor: FiltrePerClients,
    alCanviar: (valor: FiltrePerClients) => void,
  ) => {
    const senseClients = clients.length === 0;
    const actual = valor;
    return (
      <fieldset
        disabled={senseClients}
        className={`rounded-lg border border-line bg-white ${senseClients ? "opacity-50" : ""}`}
        aria-describedby={senseClients ? `${nom}-ajuda` : undefined}
      >
        <legend className="sr-only">{titol}</legend>
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px] font-medium">
          <span className="flex items-center gap-2">
            {titol}
            {!senseClients && actual !== "tots" ? <span className="rounded-full bg-wine px-1.5 py-px text-[10.5px] font-semibold text-cream">1</span> : null}
          </span>
          <span className="text-[11px] font-normal text-muted">
            {senseClients ? "sense clients" : clients.length === 1 ? "el client triat" : `els ${clients.length} clients`}
          </span>
        </div>
        <ul className="border-t border-line px-1.5 py-1">
          {opcions.map((opcio) => (
            <li key={opcio.valor}>
              <label className={`flex items-center gap-2 rounded px-1.5 py-1 text-[13px] ${senseClients ? "cursor-not-allowed" : "cursor-pointer transition hover:bg-parchment/60"}`}>
                <input
                  type="radio"
                  name={`criteri-${nom}`}
                  value={opcio.valor}
                  checked={senseClients ? opcio.valor === "tots" : actual === opcio.valor}
                  onChange={() => alCanviar(opcio.valor)}
                  className="size-3.5 shrink-0 accent-wine"
                />
                <span className="min-w-0 flex-1">{clients.length === 1 ? opcio.ambUn : opcio.etiqueta}</span>
              </label>
            </li>
          ))}
        </ul>
        {senseClients ? (
          <p id={`${nom}-ajuda`} className="border-t border-line px-3 py-1.5 text-[11.5px] text-muted">
            Tria clients a dalt per filtrar per aquí.
          </p>
        ) : null}
      </fieldset>
    );
  };

  const botoSecundari = "inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] transition hover:border-ink disabled:opacity-50";

  // ------------------------------------------------------------- criteris
  const criterisVista = (
    <div className="space-y-3">
      <label className="relative block">
        <Cerca className="pointer-events-none absolute left-3 top-1/2 size-[16px] -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={criteris.cerca}
          onChange={(e) => setCriteris({ ...criteris, cerca: e.target.value })}
          // Dins del formulari de l'activitat, Enter l'enviaria.
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Vi, celler, codi…"
          aria-label="Cerca vins"
          className="field-compacte !pl-9 text-[16px] sm:text-[13.5px]"
        />
      </label>

      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={criteris.ambFoto}
          onChange={(e) => setCriteris({ ...criteris, ambFoto: e.target.checked })}
          className="size-4 accent-wine"
        />
        Només amb foto
      </label>

      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={criteris.ambHistorics}
          onChange={(e) => {
            setCriteris({ ...criteris, ambHistorics: e.target.checked });
            if (e.target.checked) demanaHistorics();
          }}
          className="size-4 accent-wine"
        />
        Històrics
        <span className="text-[11.5px] text-muted">
          {criteris.ambHistorics
            ? historics
              ? "(ja no es venen)"
              : "llegint-los…"
            : clients.length > 0
              ? `(ara, només els que ${clients.length === 1 ? "ha" : "han"} tastat o comprat)`
              : "(ja no es venen)"}
        </span>
      </label>

      {criteriEstoc}
      {criteriPreu}

      {/* Els dos criteris que depenen dels clients triats: tastat i comprat. */}
      {criteriPerClients("Tastat", "tast", FILTRES_TAST, filtreTast, setFiltreTast)}
      {criteriPerClients("Comprat", "compra", FILTRES_COMPRA, filtreCompra, setFiltreCompra)}

      {CARACTERISTIQUES.map((caracteristica) => {
        const llista = opcions[caracteristica.clau] ?? [];
        const marcats = criteris.tria[caracteristica.clau]?.length ?? 0;
        return (
          // El tipus, que és el primer que es mira, surt desplegat; la resta, en marcar-hi res.
          <details key={caracteristica.clau} open={marcats > 0 || caracteristica.clau === "tipus"} className="group rounded-lg border border-line bg-white">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-[12.5px] font-medium">
              <span className="flex items-center gap-2">
                {caracteristica.etiqueta}
                {marcats > 0 ? (
                  <span className="rounded-full bg-wine px-1.5 py-px text-[10.5px] font-semibold text-cream">{marcats}</span>
                ) : null}
              </span>
              <span className="text-[11px] text-muted">{llista.length}</span>
            </summary>
            <ul className="scroll-slim max-h-52 overflow-y-auto border-t border-line px-1.5 py-1">
              {llista.length === 0 ? <li className="px-1.5 py-1 text-[12px] text-muted">Cap valor.</li> : null}
              {llista.map((opcio) => {
                const triat = esTriat(criteris, caracteristica.clau, opcio.valor);
                return (
                  <li key={opcio.valor}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] transition hover:bg-parchment/60 ${
                        opcio.quants === 0 && !triat ? "text-muted/60" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={triat}
                        onChange={() => setCriteris(commutaValor(criteris, caracteristica.clau, opcio.valor))}
                        className="size-3.5 shrink-0 accent-wine"
                      />
                      <span className="min-w-0 flex-1 truncate">{opcio.valor}</span>
                      <span className="text-[11px] tabular-nums text-muted">{opcio.quants}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      {posats > 0 ? (
        <button
          type="button"
          onClick={() => {
            setCriteris(CRITERIS_BUITS);
            setFiltreTast("tots");
            setFiltreCompra("tots");
            setFiltreEstoc("tots");
          }}
          className="text-[13px] text-muted transition hover:text-ink"
        >
          Treu els criteris
        </button>
      ) : null}
    </div>
  );

  // ------------------------------------------------------------- cistella
  const cistellaVista = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-line pb-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Plantilla</span>
          <select
            value={carregada?.id ?? ""}
            onChange={(e) => (e.target.value === "nova" ? nova() : void carrega(e.target.value))}
            disabled={ocupat || !cataleg}
            className="field-compacte text-[16px] sm:text-[13.5px]"
          >
            <option value="">{carregada ? "Carrega una altra…" : plantilles.length === 0 ? "Encara no n'hi ha cap: fes-ne una" : "Carrega una plantilla…"}</option>
            <option value="nova">+ Nova plantilla</option>
            {plantilles.map((plantilla) => (
              <option key={plantilla.id} value={plantilla.id}>
                {plantilla.nom} · {plantilla.vins} {plantilla.vins === 1 ? "vi" : "vins"}
                {plantilla.qui ? ` · ${plantilla.qui}` : ""}
              </option>
            ))}
          </select>
        </label>
        {carregada ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
            <span className="min-w-0 truncate">
              Carregada: <span className="text-ink">{carregada.nom}</span>
            </span>
            {confirmaEsborrar ? (
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => void esborra()} disabled={ocupat} className="text-wine-deep transition hover:underline">
                  Sí, esborra-la
                </button>
                <button type="button" onClick={() => setConfirmaEsborrar(false)} className="transition hover:text-ink">
                  No
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmaEsborrar(true)} className="transition hover:text-wine">
                Esborra la plantilla
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto py-2">
        {linies.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-muted">
            La cistella és buida. Afegeix-hi vins de la llista, o carrega una plantilla.
          </p>
        ) : (
          <ul className="divide-y divide-line/70">
            {linies.map((linia) => (
              <li key={linia.vi.id} className="flex flex-wrap items-center gap-2 py-2">
                <FotoArticle petita={linia.vi.foto} gran={null} nom={linia.vi.nom} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13px] text-ink">{linia.vi.nom}</span>
                    {linia.vi.historic ? <EtiquetaHistoric /> : null}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted">{linia.vi.detall}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Treu ${linia.vi.nom}`}
                  onClick={() => setLinies(treuDeLaCistella(linies, linia.vi.id))}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-[16px] leading-none text-muted transition hover:bg-parchment hover:text-wine"
                >
                  ×
                </button>
                {/* Les marques de tast i compra, a sota de tota la línia: la columna és estreta. Sense marques, no ocupa res. */}
                <span className="flex basis-full flex-wrap items-center gap-1.5 pl-11 empty:hidden">
                  {marcaDePreu(linia.vi)}
                  {marcaDEstoc(linia.vi)}
                  {marcaDeTast(linia.vi)}
                  {marcaDeCompra(linia.vi)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted">
            {linies.length} {linies.length === 1 ? "vi" : "vins"}
          </span>
          {linies.length > 0 ? (
            <button type="button" onClick={buida} className="text-muted transition hover:text-wine">
              Buida
            </button>
          ) : null}
        </div>

        {/* Els clients han vingut d'un dia de visita: la cistella es pot posar a les activitats d'aquell dia. */}
        {diaVisita && visitesPerPosar > 0 && linies.length > 0 && !desant ? (
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-[12.5px]">
            {linies.length > MAXIM_VINS_PER_ACTIVITAT ? (
              <p className="text-muted">
                Una activitat porta com a molt {MAXIM_VINS_PER_ACTIVITAT} vins: treu-ne de la cistella per posar-los a les visites del {dataCurta(diaVisita)}.
              </p>
            ) : confirmaVisites ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink">
                  Posar {linies.length === 1 ? "el vi" : `els ${linies.length} vins`} a {visitesPerPosar === 1 ? "la visita" : `les ${visitesPerPosar} visites`} del {dataCurta(diaVisita)}? Els que ja hi siguin es queden.
                </span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => setConfirmaVisites(false)} disabled={ocupat} className={botoSecundari}>
                    No
                  </button>
                  <button type="button" onClick={() => void posaALesVisites()} disabled={ocupat} className="btn-compacte">
                    {posantALesVisites ? "Posant…" : "Sí, posa'ls"}
                  </button>
                </span>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmaVisites(true)} disabled={ocupat} className={`${botoSecundari} w-full`}>
                <Agenda className="mr-1.5 size-4 text-muted" />
                Posa&apos;ls a {visitesPerPosar === 1 ? "la visita" : `les ${visitesPerPosar} visites`} del {dataCurta(diaVisita)}
              </button>
            )}
          </div>
        ) : null}

        {desant ? (
          <div className="space-y-2 rounded-lg border border-line bg-white p-3">
            <input
              type="text"
              value={desant.nom}
              onChange={(e) => setDesant({ ...desant, nom: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Nom de la plantilla"
              aria-label="Nom de la plantilla"
              autoFocus
              className="field-compacte text-[16px] sm:text-[13.5px]"
            />
            <textarea
              value={desant.descripcio}
              onChange={(e) => setDesant({ ...desant, descripcio: e.target.value })}
              placeholder="Per a què és (opcional)"
              aria-label="Descripció de la plantilla"
              rows={2}
              className="field-compacte resize-none text-[16px] sm:text-[13.5px]"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setDesant(null)} className={botoSecundari}>
                Cancel·la
              </button>
              {carregada ? (
                <button type="button" onClick={() => void desa(true)} disabled={ocupat || !desant.nom.trim()} className={botoSecundari}>
                  Desa com a nova
                </button>
              ) : null}
              <button type="button" onClick={() => void desa(false)} disabled={ocupat || !desant.nom.trim()} className="btn-compacte">
                {carregada ? `Actualitza «${carregada.nom}»` : "Desa"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDesant({ nom: carregada?.nom ?? "", descripcio: carregada?.descripcio ?? "" })}
              disabled={linies.length === 0 || ocupat}
              className={`${botoSecundari} flex-1`}
            >
              Desa com a plantilla
            </button>
            {alAplicar ? (
              <button
                type="button"
                onClick={() => alAplicar(linies.map((linia) => linia.vi))}
                className="btn-compacte flex-1 justify-center"
              >
                Aplica a l&apos;activitat
              </button>
            ) : (
              // A la pàgina del selector (no al modal d'una activitat, que ja té la seva fulla): la fulla
              // de la cistella, sense preus si no hi ha client, amb la tarifa del client si n'hi ha un,
              // i d'un en un si n'hi ha més.
              <BotoFullaVins clients={clients} vins={linies.map((linia) => linia.vi.id)} className="flex-1 justify-center" />
            )}
          </div>
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------------- resultats
  const resultatsVista = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-1 pb-2 text-[12.5px] text-muted">
        <span role="status" className="min-w-0 flex-1">
          {errorCataleg
            ? ""
            : !catalegVisible
              ? "Llegint el catàleg…"
              : `${trobats.length} de ${catalegVisible.length} ${catalegVisible.length === 1 ? "vi" : "vins"}` +
                (estocs ? ` · ${ambEstoc} amb estoc` : errorEstoc ? " · sense l'estoc" : " · llegint l'estoc…") +
                (clients.length > 0 && !carregantTastos
                  ? ` · ${trobats.filter((vi) => resumPerClients(vi, tastos, clients.length)).length} ja tastats · ${
                      trobats.filter((vi) => resumPerClients(vi, compres, clients.length)).length
                    } ja comprats`
                  : "") +
                (trobats.length > MAXIM_ENSENYATS ? ` · se n'ensenyen ${MAXIM_ENSENYATS}, afina els criteris` : "")}
        </span>
        {preus && catalegVisible && catalegVisible.length > 0 ? (
          <label className="flex items-center gap-1.5 text-muted">
            <span className="sr-only sm:not-sr-only">Ordena</span>
            <select
              value={ordre}
              onChange={(e) => setOrdre(e.target.value as OrdreVins)}
              aria-label="Ordre de la llista"
              className="field-compacte !w-auto !px-2 !py-1 !text-[12.5px]"
            >
              {ORDRES.map((opcio) => (
                <option key={opcio.valor} value={opcio.valor}>
                  {opcio.etiqueta}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {cataleg && trobats.length > 0 && trobats.length <= MAXIM_AFEGIR_DE_COP && trobats.some((vi) => !enCistella.has(vi.id)) ? (
          <button type="button" onClick={afegeixTrobats} className="text-wine transition hover:underline">
            Afegeix-los tots a la cistella
          </button>
        ) : null}
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {errorCataleg ? (
          <p role="alert" className="px-1 py-6 text-[13px] text-wine-deep">
            No s&apos;ha pogut llegir el catàleg: {errorCataleg}
          </p>
        ) : catalegVisible && catalegVisible.length === 0 ? (
          <p className="px-1 py-6 text-[13px] text-muted">El catàleg d&apos;articles encara és buit: arriba amb la sincronització de FactuSol.</p>
        ) : catalegVisible && trobats.length === 0 ? (
          <p className="px-1 py-6 text-[13px] text-muted">Cap vi compleix tots els criteris. Treu-ne algun.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {trobats.slice(0, MAXIM_ENSENYATS).map((vi) => {
              const marcat = enCistella.has(vi.id);
              const etiquetes = ["anyada", "regio", "format"].flatMap((clau) => vi.caracteristiques[clau]?.slice(0, 1) ?? []);
              return (
                <li key={vi.id} className={`flex items-center gap-2.5 px-1 py-2 ${marcat ? "shadow-[inset_3px_0_0_0_#8c2f45]" : ""}`}>
                  <FotoArticle petita={vi.foto} gran={null} nom={vi.nom} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13.5px] text-ink [overflow-wrap:anywhere]">{vi.nom}</span>
                      {vi.historic ? <EtiquetaHistoric /> : null}
                      {marcaDePreu(vi)}
                      {marcaDEstoc(vi)}
                      {marcaDeTast(vi)}
                      {marcaDeCompra(vi)}
                    </span>
                    <span className="block text-[12px] text-muted [overflow-wrap:anywhere]">{vi.detall}</span>
                    {etiquetes.length > 0 || (vi.caracteristiques.varietat?.length ?? 0) > 0 ? (
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {[...etiquetes, ...(vi.caracteristiques.varietat ?? []).slice(0, 3)].map((etiqueta, i) => (
                          <span key={`${etiqueta}-${i}`} className="rounded bg-parchment px-1.5 py-px text-[11px] text-muted">
                            {etiqueta}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  {marcat ? (
                    <button
                      type="button"
                      onClick={() => setLinies(treuDeLaCistella(linies, vi.id))}
                      aria-pressed
                      aria-label={`Treu ${vi.nom} de la cistella`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-wine/50 bg-wine-tint/50 px-2.5 py-1.5 text-[13px] text-wine-deep transition hover:border-wine"
                    >
                      ✓ A la cistella
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLinies(afegeixALaCistella(linies, vi))}
                      disabled={linies.length >= MAXIM_VINS_PER_PLANTILLA}
                      aria-label={`Afegeix ${vi.nom}`}
                      className="btn-compacte shrink-0 !px-2.5"
                    >
                      + Afegeix
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  // El que ha passat («plantilla desada», «dos vins ja no són al catàleg»): sota
  // la capçalera i, al telèfon, també dins del full obert, que si no el taparia.
  const missatges =
    missatge || avis ? (
      <div className="space-y-1 border-b border-line px-4 py-2 text-[12.5px]">
        {missatge ? <p className="text-muted">{missatge}</p> : null}
        {avis ? <p className="text-wine-deep">{avis}</p> : null}
      </div>
    ) : null;


  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Els clients de qui es vol saber què han tastat, i el criteri de tast. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2 text-[13px]">
        <button type="button" onClick={() => setModalClients(true)} aria-haspopup="dialog" className={botoSecundari}>
          <Clients className="mr-1.5 size-4 text-muted" />
          {nomesClients.length === 0 ? "Tria clients" : nomesClients.length === 1 ? "Canvia els clients" : `${nomesClients.length} clients`}
        </button>
        {/* Els leads, a part: encara no són clients, però el que tasten ja compta. */}
        <button type="button" onClick={() => setModalLeads(true)} aria-haspopup="dialog" className={botoSecundari}>
          {nomesLeads.length === 0 ? "Tria leads" : nomesLeads.length === 1 ? "Canvia els leads" : `${nomesLeads.length} leads`}
        </button>
        {/* O els de l'agenda d'un dia, triat al calendari del Planner: substitueix la tria pels clients i leads que es visiten. */}
        <button type="button" onClick={() => setModalAgenda(true)} aria-haspopup="dialog" className={botoSecundari}>
          <Agenda className="mr-1.5 size-4 text-muted" />
          {diaVisita ? `Visites del ${dataCurta(diaVisita)}` : "Dia de visita"}
        </button>
        {carregantDia ? <span className="text-[12.5px] text-muted">Llegint l&apos;agenda…</span> : null}
        {clients.length === 0 ? (
          <span className="text-muted">Tria un client, un lead o un segment, per veure quins vins ja ha tastat.</span>
        ) : (
          <>
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              {clients.slice(0, 6).map((client) => (
                <span key={client.id} className="inline-flex max-w-[200px] items-center gap-1 rounded-full bg-parchment px-2 py-0.5 text-[12px]">
                  {client.lead ? <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted">Lead</span> : null}
                  <span className="truncate">{client.text}</span>
                  <button
                    type="button"
                    aria-label={`Treu ${client.text}`}
                    onClick={() => setClients(clients.filter((altre) => altre.id !== client.id))}
                    className="text-muted transition hover:text-wine"
                  >
                    ×
                  </button>
                </span>
              ))}
              {clients.length > 6 ? <span className="text-[12px] text-muted">i {clients.length - 6} més</span> : null}
            </span>
            {carregantTastos ? <span className="text-[12.5px] text-muted">Mirant què han tastat i comprat…</span> : null}
            <button
              type="button"
              onClick={() => {
                setClients([]);
                setDiaVisita("");
                setActivitatsDelDia([]);
                setConfirmaVisites(false);
              }}
              className="text-[12.5px] text-muted transition hover:text-ink"
            >
              Treu-los
            </button>
          </>
        )}
      </div>

      <ModalAgendaDies
        obert={modalAgenda}
        triat={diaVisita}
        alTriar={(dia) => {
          setDiaVisita(dia);
          setTandaDia((tanda) => tanda + 1);
          setModalAgenda(false);
        }}
        alTancar={() => setModalAgenda(false)}
      />

      <ModalClients
        obert={modalClients}
        multiple
        triats={nomesClients}
        alCanviarTriats={(triats) => setClients([...triats, ...nomesLeads])}
        alTancar={() => setModalClients(false)}
        titol="Clients de qui mirar els tastos"
      />

      <ModalLeads
        obert={modalLeads}
        triats={nomesLeads}
        alCanviarTriats={(triats) => setClients([...nomesClients, ...triats])}
        alTancar={() => setModalLeads(false)}
      />

      {/* Al telèfon: els criteris i la cistella darrere d'un botó cada un. */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setPanellMobil("criteris")}
          aria-expanded={panellMobil === "criteris"}
          className={botoSecundari}
        >
          Criteris{posats ? ` · ${posats}` : ""}
        </button>
        <span className="flex-1" />
        <button type="button" onClick={() => setPanellMobil("cistella")} aria-expanded={panellMobil === "cistella"} className="btn-compacte">
          Cistella · {linies.length}
        </button>
      </div>

      {missatges}

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[250px_minmax(0,1fr)_340px]">
        {/* Les columnes del telèfon no es pinten mentre el seu full és obert: dos jocs de
            botons d'opció amb el mateix nom es desmarcarien l'un a l'altre. */}
        {panellMobil === "criteris" ? null : (
          <aside className="scroll-slim hidden min-h-0 overflow-y-auto border-r border-line px-4 py-3 lg:block" aria-label="Criteris de selecció">
            {criterisVista}
          </aside>
        )}

        <section className="min-h-0 px-4 py-3 lg:h-full" aria-label="Vins que compleixen els criteris">
          {resultatsVista}
        </section>

        {panellMobil === "cistella" ? null : (
          <aside className="hidden min-h-0 border-l border-line px-4 py-3 lg:block" aria-label="Cistella">
            {cistellaVista}
          </aside>
        )}
      </div>

      {panellMobil ? (
        <div role="dialog" aria-modal="true" aria-label={panellMobil === "criteris" ? "Criteris de selecció" : "Cistella"} className="fixed inset-0 z-50 flex flex-col bg-cream lg:hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-display text-[20px] leading-tight">{panellMobil === "criteris" ? "Criteris" : "Cistella"}</h2>
            <button
              type="button"
              onClick={() => setPanellMobil(null)}
              aria-label="Tanca"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition hover:text-ink"
            >
              <Tancar className="size-[18px]" />
            </button>
          </header>
          {missatges}
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-3">{panellMobil === "criteris" ? criterisVista : cistellaVista}</div>
          {panellMobil === "criteris" ? (
            <footer className="border-t border-line px-4 py-3">
              <button type="button" onClick={() => setPanellMobil(null)} className="btn-compacte w-full justify-center">
                Veure {trobats.length} {trobats.length === 1 ? "vi" : "vins"}
              </button>
            </footer>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * La marca d'un vi que algun dels clients triats ja ha tastat (o comprat).
 * Diu qui: amb un sol client, la data; amb un de sol que l'ha comprat, el seu
 * nom; i si no, quants. Tocar-la desplega sota el vi la llista dels clients
 * triats, amb la data i les ampolles dels que sí, i els que no en gris: així
 * se sap qui és qui sense cap globus, també al telèfon.
 */
function MarcaPerClients({
  vi,
  perVi,
  clients,
  participi,
  to,
}: {
  vi: ViDeCataleg;
  perVi: Record<string, Tast[]>;
  clients: ClientTriat[];
  participi: string;
  to: "vi" | "verd";
}) {
  const [obert, setObert] = useState(false);
  const resum = resumPerClients(vi, perVi, clients.length);
  if (!resum) return null;

  const ampolles = (qui: Tast) => ("ampolles" in qui ? `${(qui as { ampolles: number }).ampolles} amp.` : "");
  const text =
    clients.length === 1
      ? `${participi}${resum.qui[0].data ? ` el ${dataCurta(resum.qui[0].data)}` : ""}`
      : resum.qui.length === 1
        ? `${participi} per ${resum.qui[0].nom}`
        : `${participi} per ${resum.qui.length} de ${clients.length}`;
  const tons = { vi: "bg-wine-tint text-wine-deep", verd: "bg-emerald-50 text-emerald-800" };
  const perClient = new Map(resum.qui.map((qui) => [qui.client, qui]));

  return (
    <>
      <button
        type="button"
        onClick={() => setObert(!obert)}
        aria-expanded={obert}
        aria-label={`${text}: veure quins clients`}
        className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-medium transition hover:brightness-95 ${tons[to]}`}
      >
        <span className="truncate">{text}</span>
        <span aria-hidden className={`text-[8px] transition-transform ${obert ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      {obert ? (
        <span role="list" className="block basis-full space-y-0.5 py-0.5 text-[11.5px]">
          {clients.map((client) => {
            const qui = perClient.get(client.id);
            return (
              <span key={client.id} role="listitem" className={`flex flex-wrap items-baseline gap-x-1.5 ${qui ? "text-ink" : "text-muted/70"}`}>
                <span aria-hidden className="w-3 shrink-0 text-center">
                  {qui ? "✓" : "–"}
                </span>
                <span className="min-w-0 max-w-full truncate">{client.text}</span>
                {/* A la cistella, que és estreta, la data baixa de línia en lloc de sortir per la dreta. */}
                <span className="pl-[18px] text-muted sm:pl-0">
                  {qui ? [qui.data ? dataCurta(qui.data) : "", ampolles(qui)].filter(Boolean).join(" · ") : `no ${participi.toLowerCase()}`}
                </span>
              </span>
            );
          })}
        </span>
      ) : null}
    </>
  );
}

/** El preu d'un vi a la tarifa de venda al major, sense IVA. Un vi que no és a la tarifa ho diu en gris. */
function MarcaPreu({ preu, tarifa }: { preu: number | null; tarifa: string }) {
  if (preu === null) {
    return <span className="inline-flex shrink-0 items-center rounded-full bg-parchment px-1.5 py-px text-[10.5px] font-medium text-muted">Sense preu</span>;
  }
  return (
    <span title={`${tarifa}, sense IVA`} className="inline-flex shrink-0 items-center rounded-full bg-parchment px-1.5 py-px text-[11px] font-medium tabular-nums text-ink">
      {eurosAmbCentims(preu)}
    </span>
  );
}

/**
 * La marca de l'estoc d'un vi: quant n'hi ha disponible, sumant tots els
 * magatzems, i si l'actual és un altre número, també («Estoc 153 · actual
 * 159»: 6 ja estan compromesos; pot ser més gran, si hi ha compres pendents). Tocar-la desplega el desglòs per magatzem, amb les
 * dues xifres. Un vi sense res enlloc ho diu en gris.
 */
function MarcaEstoc({ estoc }: { estoc: EstocVi | null }) {
  const [obert, setObert] = useState(false);
  const disponible = estoc?.disponible ?? 0;
  const actual = estoc?.actual ?? 0;

  if (!estoc || estoc.magatzems.length === 0) {
    return <span className="inline-flex shrink-0 items-center rounded-full bg-parchment px-1.5 py-px text-[10.5px] font-medium text-muted">Sense estoc</span>;
  }

  const text =
    disponible <= 0
      ? `Sense estoc disponible${actual !== disponible ? ` · actual ${quantitat(actual)}` : ""}`
      : `Estoc ${quantitat(disponible)}${actual !== disponible ? ` · actual ${quantitat(actual)}` : ""}`;
  const to = disponible > 0 ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800";

  return (
    <>
      <button
        type="button"
        onClick={() => setObert(!obert)}
        aria-expanded={obert}
        aria-label={`${text}: veure per magatzem`}
        className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-medium transition hover:brightness-95 ${to}`}
      >
        <span className="truncate">{text}</span>
        <span aria-hidden className={`text-[8px] transition-transform ${obert ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      {obert ? (
        <span role="table" aria-label="Estoc per magatzem" className="block basis-full py-0.5 text-[11.5px]">
          <span role="row" className="flex items-baseline gap-x-2 text-[10.5px] uppercase tracking-[0.08em] text-muted">
            <span role="columnheader" className="min-w-0 flex-1">Magatzem</span>
            <span role="columnheader" className="w-16 shrink-0 text-right">Disponible</span>
            <span role="columnheader" className="w-12 shrink-0 text-right">Actual</span>
          </span>
          {estoc.magatzems.map((magatzem) => (
            <span key={magatzem.codi} role="row" className="flex items-baseline gap-x-2 text-ink">
              <span role="cell" className="min-w-0 flex-1 truncate">{magatzem.nom}</span>
              <span role="cell" className="w-16 shrink-0 text-right tabular-nums">{quantitat(magatzem.disponible)}</span>
              <span role="cell" className="w-12 shrink-0 text-right tabular-nums text-muted">{quantitat(magatzem.actual)}</span>
            </span>
          ))}
          {estoc.magatzems.length > 1 ? (
            <span role="row" className="flex items-baseline gap-x-2 border-t border-line/70 font-medium text-ink">
              <span role="cell" className="min-w-0 flex-1">Total</span>
              <span role="cell" className="w-16 shrink-0 text-right tabular-nums">{quantitat(disponible)}</span>
              <span role="cell" className="w-12 shrink-0 text-right tabular-nums text-muted">{quantitat(actual)}</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

/** La marca d'un vi històric: descatalogat o no disponible a FactuSol, ja no es ven. */
function EtiquetaHistoric() {
  return (
    <span className="shrink-0 rounded bg-parchment px-1.5 py-px text-[11px] text-muted" title="Descatalogat o no disponible a FactuSol: ja no es ven">
      Històric
    </span>
  );
}
