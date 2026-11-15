import {
  TIPUS_ACTIVITAT,
  TIPUS_AMB_VI,
  TIPUS_PRESENCIALS,
  TIPUS_REMOTS,
  type Activitat,
  type Etapa,
  type Oportunitat,
  type Tasca,
} from "@/domini/crm";

/** Agregacions del tauler de CRM. Funcions pures, sense dependències de React. */

const DIA = 86_400_000;
export const ETAPES_EMBUT = ["Contacte", "Qualificada", "Tast", "Proposta", "Negociació"] as const;

function mes(iso: string) {
  return iso.slice(0, 7);
}

/** Els darrers `quants` mesos, en format AAAA-MM i acabant al mes en curs. */
export function mesosRecents(quants = 12) {
  const avui = new Date();
  return Array.from({ length: quants }, (_, index) => {
    const punt = new Date(Date.UTC(avui.getUTCFullYear(), avui.getUTCMonth() - (quants - 1 - index), 1));
    return `${punt.getUTCFullYear()}-${String(punt.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function suma(valors: number[]) {
  return valors.reduce((total, valor) => total + valor, 0);
}

export type ResumCrm = {
  pipeline: number;
  ponderat: number;
  obertes: number;
  guanyades: number;
  perdudes: number;
  conversio: number;
  cicle: number;
  valorMitja: number;
  leads30: number;
  activitats30: number;
  visites30: number;
  tasquesPendents: number;
  tasquesVencudes: number;
  activitatsPerOportunitat: number;
  velocitat: number;
};

export function resumCrm(oportunitats: Oportunitat[], activitats: Activitat[], tasques: Tasca[]): ResumCrm {
  const obertes = oportunitats.filter((o) => !o.tancadaEl);
  const guanyades = oportunitats.filter((o) => o.etapa === "Guanyada");
  const perdudes = oportunitats.filter((o) => o.etapa === "Perduda");
  const tancades = guanyades.length + perdudes.length;

  const pipeline = suma(obertes.map((o) => o.valor));
  const conversio = tancades ? (guanyades.length / tancades) * 100 : 0;
  const cicle = guanyades.length
    ? suma(guanyades.map((o) => (new Date(o.tancadaEl!).getTime() - new Date(o.obertaEl).getTime()) / DIA)) /
      guanyades.length
    : 0;
  const valorMitja = oportunitats.length ? suma(oportunitats.map((o) => o.valor)) / oportunitats.length : 0;

  const fa30 = Date.now() - 30 * DIA;
  const recents = activitats.filter((a) => new Date(a.data).getTime() >= fa30);
  const pendents = tasques.filter((t) => !t.feta);

  return {
    pipeline,
    ponderat: suma(obertes.map((o) => (o.valor * o.probabilitat) / 100)),
    obertes: obertes.length,
    guanyades: guanyades.length,
    perdudes: perdudes.length,
    conversio,
    cicle,
    valorMitja,
    leads30: oportunitats.filter((o) => new Date(o.obertaEl).getTime() >= fa30).length,
    activitats30: recents.length,
    visites30: recents.filter((a) => TIPUS_PRESENCIALS.includes(a.tipus)).length,
    tasquesPendents: pendents.length,
    tasquesVencudes: pendents.filter((t) => new Date(t.venciment).getTime() < Date.now()).length,
    activitatsPerOportunitat: oportunitats.length ? activitats.length / oportunitats.length : 0,
    // Velocitat del pipeline: euros que travessen l'embut cada dia.
    velocitat: cicle ? (obertes.length * (conversio / 100) * valorMitja) / cicle : 0,
  };
}

/** Valor viu del pipeline al tancament de cada mes i oportunitats obertes aquell mes. */
export function pipelineMensual(oportunitats: Oportunitat[], mesos: string[]) {
  return mesos.map((clau) => {
    const final = new Date(`${clau}-01T00:00:00Z`);
    final.setUTCMonth(final.getUTCMonth() + 1);
    const limit = final.getTime();

    const vives = oportunitats.filter((o) => {
      const oberta = new Date(o.obertaEl).getTime();
      const tancada = o.tancadaEl ? new Date(o.tancadaEl).getTime() : Infinity;
      return oberta < limit && tancada >= limit;
    });

    return {
      mes: clau,
      valor: Math.round(suma(vives.map((o) => o.valor))),
      oportunitats: vives.length,
      nous: oportunitats.filter((o) => mes(o.obertaEl) === clau).length,
    };
  });
}

/** Leads nous per mes, repartits per origen. */
export function leadsPerOrigen(oportunitats: Oportunitat[], mesos: string[]) {
  const origens = [...new Set(oportunitats.map((o) => o.origen))];
  return {
    mesos,
    series: origens.map((origen) => ({
      nom: origen,
      dades: mesos.map(
        (clau) => oportunitats.filter((o) => o.origen === origen && mes(o.obertaEl) === clau).length,
      ),
    })),
  };
}

/** Embut: quantes oportunitats arriben a cada etapa i quin percentatge hi passa. */
export function embut(oportunitats: Oportunitat[]) {
  const passos = ETAPES_EMBUT.map((etapa, index) => {
    const arribades = oportunitats.filter((o) => o.etapaAssolida >= index + 1);
    return {
      etapa: etapa as string,
      oportunitats: arribades.length,
      valor: Math.round(suma(arribades.map((o) => o.valor))),
    };
  });

  const guanyades = oportunitats.filter((o) => o.etapa === "Guanyada");
  passos.push({
    etapa: "Guanyada",
    oportunitats: guanyades.length,
    valor: Math.round(suma(guanyades.map((o) => o.valor))),
  });

  const inicial = passos[0]?.oportunitats || 1;
  return passos.map((pas, index) => ({
    ...pas,
    // Percentatge sobre el total que entra i sobre l'etapa anterior.
    percentTotal: (pas.oportunitats / inicial) * 100,
    percentPas: index === 0 ? 100 : (pas.oportunitats / (passos[index - 1].oportunitats || 1)) * 100,
  }));
}

/** Tancaments per mes: guanyades, perdudes i taxa d'encert. */
export function tancamentsPerMes(oportunitats: Oportunitat[], mesos: string[]) {
  return mesos.map((clau) => {
    const tancades = oportunitats.filter((o) => o.tancadaEl && mes(o.tancadaEl) === clau);
    const guanyades = tancades.filter((o) => o.etapa === "Guanyada");
    return {
      mes: clau,
      guanyades: guanyades.length,
      perdudes: tancades.length - guanyades.length,
      valorGuanyat: Math.round(suma(guanyades.map((o) => o.valor))),
      conversio: tancades.length ? (guanyades.length / tancades.length) * 100 : 0,
    };
  });
}

/** Activitat comercial per mes, repartida per tipus. */
export function activitatPerTipus(activitats: Activitat[], mesos: string[]) {
  return {
    mesos,
    series: TIPUS_ACTIVITAT.map((tipus) => ({
      nom: tipus as string,
      dades: mesos.map((clau) => activitats.filter((a) => a.tipus === tipus && mes(a.data) === clau).length),
      // «Altres» només surt si n'hi ha: és per als tipus creats a Configuració que no són visites.
    })).filter((serie) => serie.nom !== "Altres" || serie.dades.some(Boolean)),
  };
}

/** Visites i tastos de cada comercial: el treball de carrer. */
export function visitesPerComercial(activitats: Activitat[], nomAgent: (codi: number) => string) {
  const codis = [...new Set(activitats.map((a) => a.agent))].sort((a, b) => a - b);
  return codis.map((codi) => {
    const seves = activitats.filter((a) => a.agent === codi);
    return {
      nom: nomAgent(codi),
      visites: seves.filter((a) => TIPUS_PRESENCIALS.includes(a.tipus)).length,
      tastos: seves.filter((a) => TIPUS_AMB_VI.includes(a.tipus)).length,
      remotes: seves.filter((a) => TIPUS_REMOTS.includes(a.tipus)).length,
    };
  });
}

/** Conversió i cicle de venda per canal de client. */
export function rendimentPerCanal(oportunitats: Oportunitat[], nomCanal: (codi: string) => string) {
  const canals = [...new Set(oportunitats.map((o) => o.canal))];
  return canals
    .map((canal) => {
      const seves = oportunitats.filter((o) => o.canal === canal);
      const guanyades = seves.filter((o) => o.etapa === "Guanyada");
      const perdudes = seves.filter((o) => o.etapa === "Perduda");
      const tancades = guanyades.length + perdudes.length;
      return {
        nom: nomCanal(canal),
        oportunitats: seves.length,
        conversio: tancades ? (guanyades.length / tancades) * 100 : 0,
        cicle: guanyades.length
          ? suma(
              guanyades.map((o) => (new Date(o.tancadaEl!).getTime() - new Date(o.obertaEl).getTime()) / DIA),
            ) / guanyades.length
          : 0,
        valor: Math.round(suma(seves.map((o) => o.valor))),
      };
    })
    .sort((a, b) => b.oportunitats - a.oportunitats);
}

/** Previsió: valor que hauria de tancar cada mes, brut i ponderat. */
export function previsioTancament(oportunitats: Oportunitat[]) {
  const obertes = oportunitats.filter((o) => !o.tancadaEl);
  const clausMes = [...new Set(obertes.map((o) => mes(o.tancamentPrevist)))].sort().slice(0, 8);

  return clausMes.map((clau) => {
    const seves = obertes.filter((o) => mes(o.tancamentPrevist) === clau);
    return {
      mes: clau,
      valor: Math.round(suma(seves.map((o) => o.valor))),
      ponderat: Math.round(suma(seves.map((o) => (o.valor * o.probabilitat) / 100))),
      oportunitats: seves.length,
    };
  });
}

/** Càrrega de tasques de cada comercial, segons com de urgents són. */
export function carregaTasques(tasques: Tasca[], nomAgent: (codi: number) => string) {
  const pendents = tasques.filter((t) => !t.feta);
  const codis = [...new Set(pendents.map((t) => t.agent))].sort((a, b) => a - b);
  const ara = Date.now();

  return codis.map((codi) => {
    const seves = pendents.filter((t) => t.agent === codi);
    return {
      nom: nomAgent(codi),
      vencudes: seves.filter((t) => new Date(t.venciment).getTime() < ara).length,
      setmana: seves.filter((t) => {
        const dies = (new Date(t.venciment).getTime() - ara) / DIA;
        return dies >= 0 && dies <= 7;
      }).length,
      endavant: seves.filter((t) => (new Date(t.venciment).getTime() - ara) / DIA > 7).length,
    };
  });
}

/** Perfil comparat dels comercials, per al gràfic de teranyina. */
export function radarComercials(
  oportunitats: Oportunitat[],
  activitats: Activitat[],
  nomAgent: (codi: number) => string,
) {
  const eixos = ["Oportunitats", "Guanyades", "Valor guanyat", "Visites", "Activitat", "Conversió"];
  const codis = [...new Set(oportunitats.map((o) => o.agent))].sort((a, b) => a - b);

  const metriques = codis.map((codi) => {
    const seves = oportunitats.filter((o) => o.agent === codi);
    const guanyades = seves.filter((o) => o.etapa === "Guanyada");
    const perdudes = seves.filter((o) => o.etapa === "Perduda");
    const tancades = guanyades.length + perdudes.length;
    const sevesActivitats = activitats.filter((a) => a.agent === codi);

    return {
      nom: nomAgent(codi),
      valors: [
        seves.length,
        guanyades.length,
        suma(guanyades.map((o) => o.valor)),
        sevesActivitats.filter((a) => TIPUS_PRESENCIALS.includes(a.tipus)).length,
        sevesActivitats.length,
        tancades ? (guanyades.length / tancades) * 100 : 0,
      ],
    };
  });

  const maxims = eixos.map((_, eix) => Math.max(1, ...metriques.map((m) => m.valors[eix])));
  const formata = (eix: number, valor: number) => {
    if (eix === 2) {
      return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(valor);
    }
    if (eix === 5) return `${valor.toFixed(0)} %`;
    return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 0 }).format(valor);
  };

  return {
    eixos,
    series: metriques.map((metrica) => ({
      nom: metrica.nom,
      dades: metrica.valors.map((valor, eix) => Math.round((valor / maxims[eix]) * 100)),
      brut: metrica.valors.map((valor, eix) => formata(eix, valor)),
    })),
  };
}

/** Matriu comercial × mes amb el nombre d'activitats, per al mapa de calor. */
export function mapaActivitat(activitats: Activitat[], mesos: string[], nomAgent: (codi: number) => string) {
  const codis = [...new Set(activitats.map((a) => a.agent))].sort((a, b) => a - b);
  const compte = new Map<string, number>();

  for (const activitat of activitats) {
    const clau = `${activitat.agent}|${mes(activitat.data)}`;
    compte.set(clau, (compte.get(clau) ?? 0) + 1);
  }

  const maxim = Math.max(1, ...compte.values());
  return {
    mesos,
    files: codis.map((codi) => ({
      nom: nomAgent(codi),
      celles: mesos.map((clau) => {
        const valor = compte.get(`${codi}|${clau}`) ?? 0;
        return { mes: clau, valor, intensitat: valor / maxim };
      }),
    })),
  };
}

export type { Etapa };
