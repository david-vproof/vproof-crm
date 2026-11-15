/**
 * Model de la taula F_CLI de FactuSol.
 *
 * Només s'hi recullen les columnes que el portal fa servir: la taula real en
 * té 200. Es conserven els noms originals perquè les consultes SQL enviades a
 * l'API es llegeixin igual que aquest tipus.
 */
export type Client = {
  CODCLI: number; // Codi de client (clau)
  NIFCLI: string; // NIF / CIF
  NOFCLI: string; // Nom fiscal
  NOCCLI: string; // Nom comercial
  DOMCLI: string; // Domicili
  POBCLI: string; // Població
  CPOCLI: string; // Codi postal
  PROCLI: string; // Província
  PAICLI: string; // País
  TELCLI: string; // Telèfon
  MOVCLI: string; // Mòbil
  EMACLI: string; // Correu
  WEBCLI: string; // Web
  PCOCLI: string; // Persona de contacte
  TCLCLI: string; // Tipus de client
  AGECLI: number; // Agent comercial assignat
  FPACLI: string; // Forma de pagament
  TARCLI: number; // Tarifa aplicada
  DP1CLI: number; // Descompte en percentatge
  RETCLI: number; // Retenció IRPF
  CRFCLI: number; // Risc màxim concedit
  ESTCLI: number; // Desplegable «Estado»: 0 sense seleccionar, 1 habitual, 2 esporàdic, 3 baixa, 4 captació
  FALCLI: string; // Data d'alta (ISO)
  FUMCLI: string; // Data del darrer moviment (ISO)
  OBSCLI: string; // Observacions
  // Compte bancari, trossejat tal com el desa FactuSol
  PBACLI: string; // Codi IBAN de país
  DBACLI: string; // Dígits de control de l'IBAN
  ENTCLI: string; // Entitat
  OFICLI: string; // Oficina
  DCOCLI: string; // Dígit de control
  CUECLI: string; // Número de compte
  BANCLI: string; // Nom del banc
  // Persones de contacte addicionals (F_CLI n'admet 5)
  NO1CLI: string;
  TF1CLI: string;
  EM1CLI: string;
  NO2CLI: string;
  TF2CLI: string;
  EM2CLI: string;
  // Primera adreça d'enviament alternativa (F_CLI n'admet 4)
  ACO1CLI: string; // Nom
  ADO1CLI: string; // Domicili
  ACP1CLI: string; // Codi postal
  APO1CLI: string; // Població
  APR1CLI: string; // Província
};

export type LlistaClients = {
  files: Client[];
  total: number;
  pagina: number;
  perPagina: number;
  /** Exercici fiscal consultat, que l'API exigeix a cada crida. */
  exercici: string;
};

/**
 * Columnes de F_CLI que ensenya la taula de comprovació de Configuració: les
 * que identifiquen la fitxa i les que la sincronització farà servir primer.
 */
export type ClientResum = Pick<
  Client,
  | "CODCLI" | "NIFCLI" | "NOFCLI" | "NOCCLI" | "DOMCLI" | "CPOCLI" | "POBCLI" | "PROCLI"
  | "TELCLI" | "MOVCLI" | "EMACLI" | "PCOCLI" | "AGECLI" | "FPACLI" | "TARCLI" | "ESTCLI" | "FALCLI"
>;

export type LlistaClientsResum = {
  files: ClientResum[];
  total: number;
  pagina: number;
  perPagina: number;
  exercici: string;
};

/**
 * Model de la taula F_PRO de FactuSol: proveïdors i creditors.
 *
 * Com amb F_CLI, només hi ha les columnes que el portal fa servir (la taula
 * real en té 104) i es conserven els noms originals. Els camps s'han triat
 * mirant què porta dades a la instal·lació: la meitat de les columnes hi són
 * sempre buides.
 */
export type Proveidor = {
  CODPRO: number; // Codi de proveïdor (clau)
  TIPPRO: number; // 0 = proveïdor de mercaderia, 1 = creditor de serveis
  NIFPRO: string; // NIF / CIF
  NOFPRO: string; // Nom fiscal
  NOCPRO: string; // Nom comercial
  DOMPRO: string; // Domicili
  POBPRO: string; // Població
  CPOPRO: string; // Codi postal
  PROPRO: string; // Província
  PAIPRO: string; // País (codi ISO numèric)
  TELPRO: string; // Telèfon
  MOVPRO: string; // Mòbil
  EMAPRO: string; // Correu
  WEBPRO: string; // Web
  PCOPRO: string; // Persona de contacte
  FPAPRO: string; // Forma de pagament (codi de F_FPA)
  RETPRO: number; // Retenció IRPF en percentatge
  DP1PRO: number; // Descompte en percentatge
  HOMPRO: number; // «Proveedor homologado» d'Otros datos: 1 són els cellers de qui es compra
  ESTPRO: number; // 0 = actiu, 1 = bloquejat; la instal·lació també en té 3
  FALPRO: string; // Data d'alta (ISO)
  FUMPRO: string; // Data del darrer moviment (ISO)
  OBSPRO: string; // Observacions
  CCEPRO: string; // Compte comptable
  // Dades de pagament
  SWFPRO: string; // IBAN
  SWIPRO: string; // BIC / SWIFT
  BANPRO: string; // Nom del banc
};

/** Columnes de F_PRO que ensenya la taula de comprovació de Configuració. */
export type ProveidorResum = Pick<
  Proveidor,
  | "CODPRO" | "TIPPRO" | "NIFPRO" | "NOFPRO" | "NOCPRO" | "DOMPRO" | "CPOPRO" | "POBPRO"
  | "PROPRO" | "TELPRO" | "EMAPRO" | "PCOPRO" | "FPAPRO" | "ESTPRO" | "FALPRO"
>;

export type LlistaProveidorsResum = {
  files: ProveidorResum[];
  total: number;
  pagina: number;
  perPagina: number;
  exercici: string;
};

/**
 * Model de la taula F_ART de FactuSol: els articles, que a la bodega són els
 * vins. Com amb F_CLI i F_PRO, només hi ha les columnes que el portal fa servir.
 * A diferència dels altres dos, el codi és de text.
 */
export type Article = {
  CODART: string; // Codi d'article (clau, de text)
  DESART: string; // Descripció
  FAMART: string; // Família (codi de F_FAM)
  EANART: string; // Codi de barres
  PHAART: number; // Proveïdor habitual (codi de F_PRO): el celler
  REFART: string; // Referència del proveïdor
  FALART: string; // Data d'alta (ISO)
  IMGART: string; // Nom del fitxer de la foto, amb la data: canvia quan canvia la foto
  GARART: string; // Garantia
  // Camps programables: el títol de cadascun el posa la bodega a FactuSol
  CP1ART: string;
  CP2ART: string;
  CP3ART: string;
  CP4ART: string;
  CP5ART: string;
  DSCART: number; // Casella «descatalogat»: 0 si no ho és
  NPUART: number; // Casella «no permetre'n l'ús»: 0 si es pot fer servir
};
