# vproof CRM

Portal de gestió comercial en Next.js 15 (App Router) per a una distribuïdora
de **producte sanitari veterinari**.

- **CRM**: leads, clients, oportunitats, contactes i activitats (visites,
  presentacions de producte, visites de laboratori a client…), amb tauler
  analític, agenda, To-Do, mapa de clients i segmentació per criteris.
- **Catàleg**: laboratoris i productes, amb les característiques veterinàries
  (categoria, principi actiu, espècie, forma farmacèutica, via, prescripció,
  format), preu i estoc. Selector de productes per criteris i fulla en PDF.
- **Base de dades SQLite** pròpia (`better-sqlite3`): no depèn de cap servei extern.
- **ERP**: es connectarà a vprooferp. Mentrestant, tot es pot crear des del portal.

La llista completa de funcionalitats, amb l'estat de cadascuna, és a
[`docs/FUNCIONALITATS.md`](docs/FUNCIONALITATS.md).

```bash
npm install
npm run dev     # http://localhost:3000
```

El primer cop es crea la base de dades a `dades/vproof-crm.sqlite` amb un
administrador: `PORTAL_USUARI` / `PORTAL_CONTRASENYA` (per defecte
`admin@vproof.local` / `admin`). Canvia la contrasenya a **El meu compte**.

## Estructura

El codi va per capes, i cada una només pot mirar cap avall. La presentació no
coneix cap sistema extern; qui hi parla és `apis/`, i el pont entre les dues
coses és `serveis/`.

```
app/          Presentació · rutes, pàgines i accions de servidor (Next)
components/   Presentació · interfície, gràfics i el PDF
serveis/      Casos d'ús · l'única porta que la presentació pot travessar
apis/         Sistemes externs i magatzems
  sqlite/         la base de dades: model, motor de consultes, identitat i fitxers
  geocodificacio/ OpenStreetMap (Nominatim), per situar els clients al mapa
domini/       Tipus i càlcul pur, sense entrada ni sortida
lib/          Transversal · sessió signada, format, navegació i programador
middleware.ts Protegeix les rutes del portal (runtime de Node)
```

| Capa | Pot importar |
| --- | --- |
| `app/`, `components/` | `serveis/`, `domini/`, `lib/` |
| `serveis/` | `apis/`, `domini/`, `lib/` |
| `apis/` | `domini/`, `lib/` |
| `domini/` | res: és càlcul pur |

## Base de dades

`apis/sqlite/` substitueix el Directus que feia servir el portal d'origen:

- **`model.ts`** és l'únic lloc on es declaren les taules, els camps i les
  relacions (many-to-one i one-to-many). En arrencar, `bd.ts` crea les taules
  que falten i hi afegeix les columnes noves; no esborra mai res.
- **`consulta.ts`** és un motor de consultes que entén el mateix llenguatge que
  ja parlaven els serveis: `fields` amb camps que travessen relacions
  (`client.nom_comercial`, `linies.article.nom`), filtres en JSON (`_and`,
  `_or`, `_eq`, `_in`, `_null`, `_icontains`, `_between`…, també sobre taules
  relacionades), `sort`, `limit`/`offset`, `meta=filter_count` i agregats
  (`aggregate[count]=id&groupBy[]=client`). Un camp que no és al model dona
  error: així un error de programació es veu de seguida.
- **`index.ts`** i **`usuaris.ts`**: comptes, rols i contrasenyes (scrypt).
- **`fitxers.ts`**: fotos i documents al disc (`dades/fitxers/`), servits amb
  les transformacions de mida i format que fan falta (sharp).
- Dades de partida (només si la taula és buida): rols, primer administrador,
  tipus d'activitat, tipus de client del sector i franges de categoria.

Per fer-ne una còpia de seguretat n'hi ha prou de copiar el directori `dades/`
(amb el portal aturat, o amb `sqlite3 vproof-crm.sqlite ".backup còpia.sqlite"`).

## ERP (vprooferp)

Encara no hi ha connector. El model ja preveu el que hi arribarà: cada fitxa
porta `font` (`erp` o `portal`) i `codi_erp`, i les que vinguin de l'ERP tindran
els camps de l'ERP bloquejats al formulari. Les taules que esperen l'ERP són a
[`docs/FUNCIONALITATS.md`](docs/FUNCIONALITATS.md#7-pendent-connexió-amb-vprooferp).
El punt d'entrada serà `serveis/erp.ts`, i la importació periòdica anirà al
programador (`lib/programador.ts`).

## Tauler de CRM

Fet amb **Highcharts** (`highcharts` + `highcharts-react-official`), amb tema
propi a `components/grafics/tema.ts`. Els mòduls són UMD i peten si s'executen
al render de servidor, així que `components/grafics/Grafic.tsx` els carrega amb
`next/dynamic` i `ssr: false`.

> Highcharts és de pagament per a ús comercial. Per a un desplegament real cal
> la llicència corresponent; vegeu <https://highcharts.com/license>.

## Desplegament

Amb Docker, en qualsevol servidor:

```bash
cp .env.example .env          # omple AUTH_SECRET, PORTAL_USUARI i PORTAL_CONTRASENYA
docker compose up -d --build  # http://servidor:3000
```

La base de dades i els fitxers queden al volum `dades`: refer el contenidor no
els toca. Per desplegar des d'un ordinador amb accés SSH al servidor:

```bash
SERVIDOR=usuari@host ./desplega.sh
```

`desplega.sh` comprova tipus i lint, puja el codi amb rsync a `/opt/vproof-crm`
(o `DESTI`) i hi fa `docker compose up -d --build`. El fitxer `.env` del
servidor s'hi crea un cop, a mà.

Variables: vegeu [`.env.example`](.env.example).

## Com a app al mòbil

El portal és instal·lable: a iOS, Compartir → «Afegeix a la pantalla d'inici»;
a Android, Chrome ofereix «Instal·la l'aplicació». S'obre a `/crm` sense la
barra del navegador. El manifest surt de `app/manifest.ts` i les icones es
dibuixen a partir de l'emblema a `app/icon.tsx` i `app/apple-icon.tsx`.
