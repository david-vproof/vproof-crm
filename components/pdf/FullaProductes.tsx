/**
 * La fulla de productes en PDF, amb @react-pdf/renderer: es genera al servidor.
 * A4 apaïsat, cinc productes per full: el títol i una ratlla; per a cada
 * producte, la categoria en vertical, el nom amb el principi actiu a sota i la
 * foto; Espècie i Preu (sense IVA); Forma i Format; i la columna
 * d'Observacions. Tot en negre. A peu de pàgina, la marca i el contacte de qui
 * treu la fulla, centrats.
 *
 * Tot va en punts i col·locat en absolut sobre la pàgina (842 × 595). La
 * lletra és l'Helvetica que porta el PDF: no cal cap fitxer de fonts.
 */
// L'«Image» del PDF no és la de l'HTML (no porta alt): amb un altre nom, el lint no les confon.
import { Document, Font, Image as ImatgePdf, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { CREU } from "@/components/Marca";
import { liniaDeContacte, preuDeFulla } from "@/domini/fulla-productes";
import type { DadesFulla } from "@/serveis/fulla-productes";

const NEGRE = "#000000";

// Cap nom de producte es parteix amb guionet: si no hi cap, baixa de línia sencer.
Font.registerHyphenationCallback((paraula) => [paraula]);

/** Quants productes hi caben en un full. */
const PRODUCTES_PER_FULL = 5;

/**
 * La geometria de la fulla, en punts des de dalt i des de l'esquerra de la
 * pàgina. Cada producte ocupa una franja de 100 punts.
 */
const PAGINA = { amplada: 842, alcada: 595 };
const MARGE = 30;
const PRIMERA_FRANJA = 62;
const FRANJA = 100;
const COLUMNA = { nom: 57, especie: 317, forma: 437, observacions: 627 };
/** La caixa on va la foto del producte, alineada amb el nom. */
const AMPOLLA = { left: COLUMNA.nom, top: 46, amplada: 150, alcada: 42 };

/**
 * react-pdf posa la línia base del text a la part de dalt de la seva caixa més
 * l'ascendent de la font, i la caixa d'una línia fa ascendent + descendent +
 * interlineat de la font: així es col·loca un text perquè la línia base caigui
 * just on toca.
 */
const ASCENDENT = { regular: 0.93, light: 0.93 };
const ALCADA_LINIA = { regular: 1.16, light: 1.16 };
const regular = (mida: number, liniaBase: number) => ({ fontFamily: "Helvetica-Bold", fontSize: mida, top: liniaBase - ASCENDENT.regular * mida });
const light = (mida: number, liniaBase: number) => ({ fontFamily: "Helvetica", fontSize: mida, top: liniaBase - ASCENDENT.light * mida });

const MIDA = { titol: 14.45, nom: 11.9, etiqueta: 10.2, valor: 9.35, tipus: 9.35, contacte: 5.95 };

const estil = StyleSheet.create({
  pagina: { padding: 0, fontFamily: "Helvetica", color: NEGRE },
  absolut: { position: "absolute" },
  titol: { ...regular(MIDA.titol, 50), position: "absolute", left: MARGE },
  ratllaTitol: { position: "absolute", left: MARGE, right: MARGE, top: 55.5, height: 1, backgroundColor: NEGRE },
  franja: { position: "absolute", left: MARGE, right: MARGE, height: FRANJA },
  // Una ratlla a part i no una vora: la vora desplaçaria el que hi ha dins de la franja.
  separador: { position: "absolute", left: 0, right: 0, top: -0.125, height: 0.25, backgroundColor: NEGRE },
  // El nom i el principi actiu van en flux, perquè un nom llarg que baixi de línia no trepitgi el principi actiu.
  producte: { position: "absolute", left: COLUMNA.nom - MARGE, top: light(MIDA.nom, 22.21).top, width: COLUMNA.especie - COLUMNA.nom - 2 },
  nom: { fontFamily: "Helvetica", fontSize: MIDA.nom },
  principiActiu: { fontFamily: "Helvetica", fontSize: MIDA.valor, marginTop: light(MIDA.valor, 35.95).top - light(MIDA.nom, 22.21).top - ALCADA_LINIA.light * MIDA.nom },
  foto: { width: AMPOLLA.amplada, height: AMPOLLA.alcada, position: "relative" },
  etiqueta: { ...light(MIDA.etiqueta, 22), position: "absolute" },
  valor: { ...light(MIDA.valor, 35.95), position: "absolute" },
  segonaEtiqueta: { ...light(MIDA.etiqueta, 56), position: "absolute" },
  segonValor: { ...light(MIDA.valor, 69.95), position: "absolute" },
  logotip: { position: "absolute", left: 0, right: 0, top: PAGINA.alcada - 44, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  emblema: { width: 16, height: 16, marginRight: 5 },
  nomMarca: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  contacte: { ...regular(MIDA.contacte, PAGINA.alcada - 15), position: "absolute", left: 0, right: 0, textAlign: "center", textTransform: "uppercase" },
});

/**
 * Les mides del text del tipus en vertical. La caixa es gira al voltant del
 * seu centre: es col·loca de manera que, un cop vertical, la línia base quedi
 * a 38 punts de l'esquerra de la pàgina i el text acabi 4 punts sota el quadrat.
 */
const TIPUS = { amplada: 70, alcada: 12 };
const tipusVertical = {
  position: "absolute" as const,
  width: TIPUS.amplada,
  height: TIPUS.alcada,
  left: 38 - MARGE - TIPUS.amplada / 2 - ASCENDENT.light * MIDA.tipus + TIPUS.alcada / 2,
  top: 28 - TIPUS.alcada / 2 + TIPUS.amplada / 2,
  fontFamily: "Helvetica",
  fontSize: MIDA.tipus,
  textAlign: "right" as const,
  transform: "rotate(-90deg)",
};

/**
 * La foto del producte, alineada amb el nom. Si és més alta que ampla (un
 * flascó dret), s'ajeu perquè hi càpiga; si no (una caixa), va tal com és.
 */
function Foto({ foto, sotaPrincipiActiu }: { foto: DadesFulla["productes"][number]["foto"]; sotaPrincipiActiu: boolean }) {
  if (!foto) return null;
  const dreta = foto.alcada > foto.amplada;
  const { amplada, alcada } = AMPOLLA;
  // On acaba el text de sobre: el nom sol, o el nom i el principi actiu.
  const final = sotaPrincipiActiu ? light(MIDA.valor, 35.95).top + ALCADA_LINIA.light * MIDA.valor : light(MIDA.nom, 22.21).top + ALCADA_LINIA.light * MIDA.nom;
  return (
    <View style={[estil.foto, { marginTop: AMPOLLA.top - final }]}>
      {dreta ? (
        <ImatgePdf
          src={{ data: foto.data, format: foto.format }}
          style={{
            position: "absolute",
            width: alcada,
            height: amplada,
            left: (amplada - alcada) / 2,
            top: (alcada - amplada) / 2,
            objectFit: "contain",
            // La base del producte, que és a baix de la foto, cau a l'esquerra un cop girada.
            objectPositionY: "100%",
            transform: "rotate(90deg)",
          }}
        />
      ) : (
        <ImatgePdf src={{ data: foto.data, format: foto.format }} style={{ width: amplada, height: alcada, objectFit: "contain", objectPositionX: "0%" }} />
      )}
    </View>
  );
}

function Dada({
  etiqueta, valor, left, segona = false, amplada, linies,
}: { etiqueta: string; valor: string | null; left: number; segona?: boolean; amplada?: number; linies?: number }) {
  return (
    <>
      <Text style={[segona ? estil.segonaEtiqueta : estil.etiqueta, { left }]}>{etiqueta}</Text>
      {valor ? (
        <Text style={[segona ? estil.segonValor : estil.valor, { left }, amplada ? { width: amplada } : {}, linies ? { maxLines: linies } : {}]}>
          {valor}
        </Text>
      ) : null}
    </>
  );
}

/** La categoria del producte, en vertical a l'esquerra de la franja. */
function Tipus({ tipus }: { tipus: string | null }) {
  return tipus ? <Text style={tipusVertical}>{tipus.toLowerCase()}</Text> : null;
}

export function FullaProductes({ dades }: { dades: DadesFulla }) {
  // Cinc productes per full: les pàgines es fan a mà
  // perquè la capçalera i el peu surtin a cada una i cap fila es parteixi.
  const fulls: DadesFulla["productes"][] = [];
  for (let i = 0; i < dades.productes.length; i += PRODUCTES_PER_FULL) fulls.push(dades.productes.slice(i, i + PRODUCTES_PER_FULL));

  return (
    <Document title={`${dades.titol}${dades.destinatari ? ` · ${dades.destinatari}` : ""}`} author="vproof CRM" language="ca">
      {fulls.map((productes, numero) => (
        <Page key={numero} size="A4" orientation="landscape" style={estil.pagina}>
          <Text style={estil.titol}>{dades.titol.toUpperCase()}</Text>
          <View style={estil.ratllaTitol} />

          {productes.map((producte, posicio) => (
            <View key={producte.id} style={[estil.franja, { top: PRIMERA_FRANJA + posicio * FRANJA }]}>
              {posicio > 0 ? <View style={estil.separador} /> : null}
              <Tipus tipus={producte.tipus} />
              <View style={estil.producte}>
                <Text style={estil.nom}>{producte.nom}</Text>
                {producte.principiActiu ? <Text style={estil.principiActiu}>{producte.principiActiu}</Text> : null}
                <Foto foto={producte.foto} sotaPrincipiActiu={Boolean(producte.principiActiu)} />
              </View>
              <Dada etiqueta="Espècie" valor={producte.especie} left={COLUMNA.especie - MARGE} amplada={COLUMNA.forma - COLUMNA.especie - 8} linies={1} />
              {dades.ambPreus ? <Dada etiqueta="Preu (sense IVA)" valor={preuDeFulla(producte.preu, producte.descompte)} left={COLUMNA.especie - MARGE} segona /> : null}
              <Dada etiqueta="Forma" valor={producte.forma} left={COLUMNA.forma - MARGE} amplada={COLUMNA.observacions - COLUMNA.forma - 8} linies={1} />
              <Dada etiqueta="Format" valor={producte.format} left={COLUMNA.forma - MARGE} segona />
              {/* Les observacions del comercial, si n'hi ha: cabuda fins al marge i com a molt cinc línies, que és el que hi cap a la franja. */}
              <Dada etiqueta="Observacions" valor={producte.observacions} left={COLUMNA.observacions - MARGE} amplada={PAGINA.amplada - MARGE - COLUMNA.observacions} linies={5} />
            </View>
          ))}

          <View style={estil.logotip}>
            <Svg viewBox="0 0 24 24" style={estil.emblema}>
              <Path d={CREU.escut} fill={NEGRE} />
              <Path d={CREU.creu} fill="#ffffff" />
            </Svg>
            <Text style={estil.nomMarca}>vproof CRM</Text>
          </View>
          <Text style={estil.contacte}>{liniaDeContacte(dades.contacte)}</Text>
        </Page>
      ))}
    </Document>
  );
}
