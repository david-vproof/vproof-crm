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

vprooferp és un ERPNext. El CRM en llegeix, per l'API REST, els grups de
client, els comercials, els proveïdors (laboratoris), els clients amb les seves
adreces, els articles amb el preu, l'estoc i la foto, els albarans i les
factures. És en una sola direcció i es fa cada 30 minuts o a mà des de
Configuració. Detall i correspondència de camps a
[`docs/FUNCIONALITATS.md`](docs/FUNCIONALITATS.md#7-connexió-amb-vprooferp-erpnext).

La connexió (adreça, site, clau i secret d'API, llista de preus i minuts entre
sincronitzacions) la posa l'administrador a **Configuració › Connexió amb
l'ERP**. El que no s'hi posi surt de l'entorn: `VPROOFERP_URL`,
`VPROOFERP_HOST` (el site de Frappe, si l'adreça no ho és),
`VPROOFERP_API_KEY`, `VPROOFERP_API_SECRET`, `VPROOFERP_LLISTA_PREUS` (per
defecte, «Standard Selling») i `VPROOFERP_SINCRO_MINUTS` (per defecte 30; 0
l'atura).

## Tauler de CRM

Fet amb **Highcharts** (`highcharts` + `highcharts-react-official`), amb tema
propi a `components/grafics/tema.ts`. Els mòduls són UMD i peten si s'executen
al render de servidor, així que `components/grafics/Grafic.tsx` els carrega amb
`next/dynamic` i `ssr: false`.

> Highcharts és de pagament per a ús comercial. Per a un desplegament real cal
> la llicència corresponent; vegeu <https://highcharts.com/license>.

## Desplegament

### A la VM de l'ERP (Google Cloud)

El CRM corre a la mateixa VM que l'ERP (`erpnext`, projecte `vprooferp`,
`europe-southwest1-a`), en un contenidor a part (`vproof-crm`), i s'hi entra pel
Caddy de l'ERP amb HTTPS: **https://crm.34-175-54-50.sslip.io** (sslip.io
resol el nom a la IP de la VM; amb un domini propi, es posa a `CRM_HOST`). Al
Caddyfile de l'ERP (`/opt/erpnext/Caddyfile`) s'hi afegeix només el bloc del
CRM, entre marques, i el temporitzador `vproof-crm-proxy.timer` de la VM el
torna a posar si un desplegament de l'ERP el reescriu.
Es desplega amb el workflow **Desplega el CRM a Google Cloud**
(`.github/workflows/desplega-gcp.yml`), a mà des de la pestanya Actions:
compila la imatge, la copia a la VM per SSH i arrenca el contenidor. L'ERP no
es toca. Les dades són al volum `vproof-crm-dades` de la VM i la configuració a
`/var/lib/vproof-crm/env`, que es crea el primer cop.

La contrasenya inicial d'`admin@vproof.local` és la del secret
`CRM_ADMIN_PASSWORD` del repositori, si n'hi ha; si no, se'n genera una i
s'escriu al port sèrie de la VM (consola de Google Cloud › VM › Registres ›
Port sèrie 1, línia `VPROOF_CRM_ADMIN`).

### En qualsevol servidor

Amb Docker:

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
