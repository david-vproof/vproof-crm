/**
 * L'adreça d'un compte tal com la vol un geocodificador.
 *
 * Les adreces de l'ERP porten el que calgui per trobar la porta: «PLAÇA
 * BELL-LLOC 4 BX 3», «C/ ALSINA, 3 1 B.», «AVENIDA DE COVIBAR, 8 1 - LOCAL 5.»
 * Nominatim no entén el pis ni la porta: amb tot això al darrere no troba res,
 * i el compte acabava al mig del codi postal. Aquí se'n treu el soroll i queda
 * el carrer i el número, que és el que un geocodificador sap situar.
 */

export type CarrerCercable = {
  /** El carrer amb el número («Plaça BELL-LLOC, 4»), o el carrer sol si no en té. Null si no hi ha adreça. */
  carrer: string | null;
  /** El carrer sense número, per quan el número no es troba i val més el carrer que el poble. Null si és el mateix que `carrer`. */
  via: string | null;
  /**
   * El nom de la via sense el tipus ni l'article («BELL-LLOC»): «Calle Bonaventura
   * Carreras» no es troba perquè al mapa és «Carrer de Bonaventura Carreras», i
   * pel nom sol sí. Null si la via no duu tipus al davant.
   */
  nom: string | null;
  /** El número de la porta, si n'hi ha. */
  numero: string | null;
};

/** Els tipus de via, en català i castellà, tal com queden desplegats o tal com venen escrits sencers. */
const TIPUS_SENCERS =
  "Carrer|Calle|Avinguda|Avenida|Plaça|Placa|Plaza|Passeig|Paseo|Passatge|Pasaje|Carretera|Ronda|Travessera|Travesia|Travesía|Rambla|Camí|Cami|Camino|Via|Vía|Baixada|Pujada|Urbanització|Urbanizacion|Urbanización|Polígon|Poligono|Polígono";
const TIPUS_I_ARTICLE = new RegExp(`^(?:${TIPUS_SENCERS})\\s+(?:(?:de les|de las|de los|de la|dels|del|de|d')\\s*)?(?=\\S)`, "iu");

/** «Carrer de BELL-LLOC» → «BELL-LLOC»; «Avinguda DIAGONAL» → «DIAGONAL». Null si no comença per cap tipus de via. */
export function nomDeVia(via: string) {
  const nom = via.replace(TIPUS_I_ARTICLE, "").trim();
  return nom && nom !== via.trim() ? nom : null;
}

/**
 * Les abreviatures del tipus de via que l'ERP porta al davant («C/», «PZ»,
 * «PGE.», «AV/», i també «C\» amb la barra del revés, que algú tecleja),
 * desplegades: Nominatim cerca pel nom i una «C» sola no li diu res. Només si
 * l'abreviatura va seguida d'un separador: «CARRER» o «CL. Major» no s'han de
 * tocar per la meitat.
 */
const SEPARADOR = String.raw`(?:\s*[/.\\]+\s*|\s+)`;
const ABREVIATURES: [string, string][] = [
  ["C", "Carrer"], ["CL", "Calle"], ["AV", "Avinguda"], ["AVDA", "Avenida"], ["AVGDA", "Avinguda"],
  ["PL", "Plaça"], ["PÇA", "Plaça"], ["PZ", "Plaza"], ["PZA", "Plaza"],
  ["PG", "Passeig"], ["PS", "Passeig"], ["PSSG", "Passeig"], ["PSO", "Paseo"], ["PGE", "Passatge"], ["PTGE", "Passatge"],
  ["CTRA", "Carretera"], ["CRTA", "Carretera"], ["RDA", "Ronda"], ["TRAV", "Travessera"], ["TRV", "Travessera"],
];
const TIPUS_DE_VIA = ABREVIATURES.map(([curt, llarg]) => [new RegExp(`^${curt}${SEPARADOR}(?=\\S)`, "i"), `${llarg} `] as const);

/** «C/ ALSINA» → «Carrer ALSINA»; «C\ ALSINA» → «Carrer ALSINA»; «PGE. EL RIERAL» → «Passatge EL RIERAL». El que no comença per abreviatura, tal com és. */
export function desplegaTipusDeVia(via: string) {
  for (const [patro, tipus] of TIPUS_DE_VIA) if (patro.test(via)) return via.replace(patro, tipus);
  return via;
}

/** «S/N», «s/n.», «S.N.»: sense número. */
const SENSE_NUMERO = /\b[sS][\s./]*[nN]\b\.?/g;
/** «Nº 9», «N° 9», «NUM. 9», «NÚM 9», «NUMERO 52»: el que precedeix el número i no diu res. */
const PREFIX_NUMERO = /\b(?:N[ºo°]?|N[UÚ]M(?:ERO)?)\.?\s*(?=\d)/gi;
/**
 * El primer número que ve després del nom del carrer: precedit d'un separador
 * i, si és un tram («19/23», «4-6»), només el primer. El que ve darrere (pis,
 * porta, local, escala…) s'ignora.
 */
const CARRER_I_NUMERO = /^(.*?[\p{L}][\p{L}.'ªº]*)[\s,.\-]+(\d+)(?:\s*[-/]\s*\d+)?/u;

function neteja(adreca: string) {
  return adreca
    // «C\ BONAVENTURA CARRERAS, 5»: la barra invertida és la barra de «C/» mal escrita.
    .replace(/\\/g, "/")
    .replace(/\([^)]*\)/g, " ")
    .replace(SENSE_NUMERO, " ")
    .replace(PREFIX_NUMERO, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim()
    .replace(/^[\s,.\-]+|[\s,.\-]+$/g, "");
}

/**
 * «PLAÇA BELL-LLOC 4 BX 3» → «PLAÇA BELL-LLOC, 4» i via «PLAÇA BELL-LLOC».
 * «C/ ALSINA, 3 1 B.» → «Carrer ALSINA, 3» i via «Carrer ALSINA».
 * «PGE. EL RIERAL, S/N.» → «Passatge EL RIERAL», sense via a part.
 * «116/51 Rathdowne Street» (el número al davant, com fora d'aquí) es deixa tal com és.
 * «CTRA. DE FRANÇA KM 22» també: el quilòmetre no és cap número de porta.
 */
export function carrerPerGeocodificar(adreca: string | null | undefined): CarrerCercable {
  const net = neteja(adreca ?? "");
  if (!net) return { carrer: null, via: null, nom: null, numero: null };

  // Comença per un número: no és «carrer número», i tallar-la la deixaria sense carrer.
  if (/^\d/.test(net)) return { carrer: net, via: null, nom: null, numero: null };

  const tros = CARRER_I_NUMERO.exec(net);
  if (!tros) {
    const carrer = desplegaTipusDeVia(net);
    return { carrer, via: null, nom: nomDeVia(carrer), numero: null };
  }
  const via = desplegaTipusDeVia(tros[1].replace(/[\s,.\-]+$/, "").trim());
  // Un punt quilomètric («KM 5,5», «KM.35») no és un número de carrer.
  if (/\bKM\.?$/i.test(via)) {
    const senseKm = via.replace(/\s*\bKM\.?$/i, "").trim() || null;
    return { carrer: desplegaTipusDeVia(net), via: senseKm, nom: senseKm ? nomDeVia(senseKm) : null, numero: null };
  }
  if (!via) return { carrer: net, via: null, nom: null, numero: null };
  return { carrer: `${via}, ${tros[2]}`, via, nom: nomDeVia(via), numero: tros[2] };
}
