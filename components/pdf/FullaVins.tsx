/**
 * La fulla de vins en PDF, amb @react-pdf/renderer: es genera al servidor.
 * Reprodueix al punt la fulla «VINS TASTATS» que la bodega treu del seu
 * programa (A4 apaïsat, cinc vins per full): el títol i una ratlla; per a cada
 * vi, el quadrat del color del tipus amb el nom del tipus en vertical, el nom
 * amb les varietats a sota i l'ampolla ajaguda; Anyada i Preu (sense IVA);
 * Zona i Volum; i la columna d'Observacions en blanc. Tot en negre, sense cap
 * color més que els quadrats. A peu de pàgina, la marca i el contacte de qui
 * treu la fulla, centrats.
 *
 * Les mides i les posicions són les de la fulla de la bodega, llegides del seu
 * PDF: tot va en punts i col·locat en absolut sobre la pàgina (842 × 595), perquè
 * surti igual. La lletra és la mateixa, Maison i Maison Light.
 */
// L'«Image» del PDF no és la de l'HTML (no porta alt): amb un altre nom, el lint no les confon.
import { Document, Font, Image as ImatgePdf, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import path from "node:path";

import { EMBLEMA, NOM } from "@/components/Marca";
import { liniaDeContacte, preuDeFulla, quadratDeTipus } from "@/domini/fulla-vins";
import type { DadesFulla } from "@/serveis/fulla-vins";

const NEGRE = "#000000";

/**
 * Maison, la lletra de la bodega (la de la seva fulla): la regular per als
 * títols, els noms i les etiquetes; la light per als valors. Els fitxers són a
 * `components/pdf/fonts`, i `next.config.ts` els inclou a la sortida autònoma.
 */
const FONTS = path.join(process.cwd(), "components", "pdf", "fonts");
Font.register({
  family: "Maison",
  fonts: [
    { src: path.join(FONTS, "Maison.otf"), fontWeight: 400 },
    { src: path.join(FONTS, "MaisonLight.otf"), fontWeight: 300 },
  ],
});
// Cap nom de vi es parteix amb guionet: si no hi cap, baixa de línia sencer.
Font.registerHyphenationCallback((paraula) => [paraula]);

/** Quants vins hi caben en un full: com a la fulla de la bodega. */
const VINS_PER_FULL = 5;

/**
 * La geometria de la fulla de la bodega, en punts des de dalt i des de
 * l'esquerra de la pàgina. Cada vi ocupa una franja de 100 punts; dins la
 * franja, les posicions són les de la seva fulla.
 */
const PAGINA = { amplada: 842, alcada: 595 };
const MARGE = 30;
const PRIMERA_FRANJA = 62;
const FRANJA = 100;
const COLUMNA = { nom: 57, anyada: 317, zona: 437, observacions: 627 };
/** La caixa on va l'ampolla ajaguda: la base a l'esquerra, alineada amb el nom. */
const AMPOLLA = { left: COLUMNA.nom, top: 46, amplada: 150, alcada: 42 };

/**
 * react-pdf posa la línia base del text a la part de dalt de la seva caixa més
 * l'ascendent de la font, i la caixa d'una línia fa ascendent + descendent +
 * interlineat de la font: així es col·loca un text perquè la línia base caigui
 * just on la té la fulla de la bodega.
 */
const ASCENDENT = { regular: 0.934, light: 0.9 };
const ALCADA_LINIA = { regular: 1.264, light: 1.155 };
const regular = (mida: number, liniaBase: number) => ({ fontFamily: "Maison", fontWeight: 400 as const, fontSize: mida, top: liniaBase - ASCENDENT.regular * mida });
const light = (mida: number, liniaBase: number) => ({ fontFamily: "Maison", fontWeight: 300 as const, fontSize: mida, top: liniaBase - ASCENDENT.light * mida });

const MIDA = { titol: 14.45, nom: 11.9, etiqueta: 10.2, valor: 9.35, tipus: 9.35, contacte: 5.95, lletraQuadrat: 8.6 };

/** El programa de la bodega no interlletra (kerning) ni lliga: sense, les paraules fan la mateixa amplada que a la seva fulla. */
const SENSE_KERNING = { kern: false, liga: false, calt: false };

const estil = StyleSheet.create({
  pagina: { padding: 0, fontFamily: "Maison", color: NEGRE, fontFeatureSettings: SENSE_KERNING },
  absolut: { position: "absolute" },
  titol: { ...regular(MIDA.titol, 50), position: "absolute", left: MARGE },
  ratllaTitol: { position: "absolute", left: MARGE, right: MARGE, top: 55.5, height: 1, backgroundColor: NEGRE },
  franja: { position: "absolute", left: MARGE, right: MARGE, height: FRANJA },
  // Una ratlla a part i no una vora: la vora desplaçaria el que hi ha dins de la franja.
  separador: { position: "absolute", left: 0, right: 0, top: -0.125, height: 0.25, backgroundColor: NEGRE },
  quadrat: { position: "absolute", left: 0, top: 13, width: 11, height: 11, alignItems: "center", justifyContent: "center" },
  lletraQuadrat: { fontFamily: "Maison", fontWeight: 300, fontSize: MIDA.lletraQuadrat, color: "#181619" },
  // El nom i les varietats van en flux, perquè un nom llarg que baixi de línia no trepitgi les varietats.
  vi: { position: "absolute", left: COLUMNA.nom - MARGE, top: light(MIDA.nom, 22.21).top, width: COLUMNA.anyada - COLUMNA.nom - 2 },
  // El nom en Light: la Regular, al costat de la lletra amb què l'Acrobat pinta la fulla de la bodega, semblava negreta.
  nom: { fontWeight: 300, fontSize: MIDA.nom },
  varietat: { fontWeight: 300, fontSize: MIDA.valor, marginTop: light(MIDA.valor, 35.95).top - light(MIDA.nom, 22.21).top - ALCADA_LINIA.light * MIDA.nom },
  foto: { width: AMPOLLA.amplada, height: AMPOLLA.alcada, position: "relative" },
  etiqueta: { ...light(MIDA.etiqueta, 22), position: "absolute" },
  valor: { ...light(MIDA.valor, 35.95), position: "absolute" },
  segonaEtiqueta: { ...light(MIDA.etiqueta, 56), position: "absolute" },
  segonValor: { ...light(MIDA.valor, 69.95), position: "absolute" },
  logotip: { position: "absolute", left: (PAGINA.amplada - 124.125) / 2, top: PAGINA.alcada - 20 - 22.57, width: 124.125, height: 22.57 },
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
  fontFamily: "Maison",
  fontWeight: 300 as const,
  fontSize: MIDA.tipus,
  textAlign: "right" as const,
  transform: "rotate(-90deg)",
};

/**
 * L'ampolla, ajaguda com a la fulla, amb la base a l'esquerra i el coll a la
 * dreta, alineada amb el nom. Les fotos són d'ampolla dreta: si és més alta
 * que ampla es gira; si no (una caixa, un lot), va tal com és. Com que ve
 * sense marge, omple la caixa de cap a cap.
 */
function Ampolla({ foto, sotaVarietat }: { foto: DadesFulla["vins"][number]["foto"]; sotaVarietat: boolean }) {
  if (!foto) return null;
  const dreta = foto.alcada > foto.amplada;
  const { amplada, alcada } = AMPOLLA;
  // On acaba el text de sobre: el nom sol, o el nom i les varietats.
  const final = sotaVarietat ? light(MIDA.valor, 35.95).top + ALCADA_LINIA.light * MIDA.valor : light(MIDA.nom, 22.21).top + ALCADA_LINIA.light * MIDA.nom;
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
            // La base de l'ampolla, que és a baix de la foto, cau a l'esquerra un cop girada.
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

/** El quadrat del tipus (amb la E dels escumosos) i, a sota, el tipus en vertical. */
function Tipus({ tipus }: { tipus: string | null }) {
  const quadrat = quadratDeTipus(tipus);
  return (
    <>
      {quadrat ? (
        <View style={[estil.quadrat, { backgroundColor: quadrat.color }]}>
          {quadrat.lletra ? <Text style={estil.lletraQuadrat}>{quadrat.lletra}</Text> : null}
        </View>
      ) : null}
      {tipus ? <Text style={tipusVertical}>{tipus.toLowerCase()}</Text> : null}
    </>
  );
}

export function FullaVins({ dades }: { dades: DadesFulla }) {
  // Cinc vins per full, com a la fulla de la bodega: les pàgines es fan a mà
  // perquè la capçalera i el peu surtin a cada una i cap fila es parteixi.
  const fulls: DadesFulla["vins"][] = [];
  for (let i = 0; i < dades.vins.length; i += VINS_PER_FULL) fulls.push(dades.vins.slice(i, i + VINS_PER_FULL));

  return (
    <Document title={`${dades.titol}${dades.destinatari ? ` · ${dades.destinatari}` : ""}`} author="Jaume Jordà" language="ca">
      {fulls.map((vins, numero) => (
        <Page key={numero} size="A4" orientation="landscape" style={estil.pagina}>
          <Text style={estil.titol}>{dades.titol.toUpperCase()}</Text>
          <View style={estil.ratllaTitol} />

          {vins.map((vi, posicio) => (
            <View key={vi.id} style={[estil.franja, { top: PRIMERA_FRANJA + posicio * FRANJA }]}>
              {posicio > 0 ? <View style={estil.separador} /> : null}
              <Tipus tipus={vi.tipus} />
              <View style={estil.vi}>
                <Text style={estil.nom}>{vi.nom}</Text>
                {vi.varietat ? <Text style={estil.varietat}>{vi.varietat}</Text> : null}
                <Ampolla foto={vi.foto} sotaVarietat={Boolean(vi.varietat)} />
              </View>
              <Dada etiqueta="Anyada" valor={vi.anyada} left={COLUMNA.anyada - MARGE} />
              {dades.ambPreus ? <Dada etiqueta="Preu (sense IVA)" valor={preuDeFulla(vi.preu, vi.descompte)} left={COLUMNA.anyada - MARGE} segona /> : null}
              <Dada etiqueta="Zona" valor={vi.zona} left={COLUMNA.zona - MARGE} />
              <Dada etiqueta="Volum" valor={vi.volum} left={COLUMNA.zona - MARGE} segona />
              {/* Les observacions del comercial, si n'hi ha: cabuda fins al marge i com a molt cinc línies, que és el que hi cap a la franja. */}
              <Dada etiqueta="Observacions" valor={vi.observacions} left={COLUMNA.observacions - MARGE} amplada={PAGINA.amplada - MARGE - COLUMNA.observacions} linies={5} />
            </View>
          ))}

          <Svg viewBox="0 0 143 26" style={estil.logotip}>
            {[...NOM, ...EMBLEMA].map((d) => (
              <Path key={d.slice(0, 16)} d={d} fill={NEGRE} />
            ))}
          </Svg>
          <Text style={estil.contacte}>{liniaDeContacte(dades.contacte)}</Text>
        </Page>
      ))}
    </Document>
  );
}
