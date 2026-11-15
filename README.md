# vproof CRM

Portal de gestió en Next.js 15 (App Router) per a una distribuïdora de producte.

- **CRM** sobre **Directus**: leads, comptes, oportunitats, contactes i
  activitats —incloses les visites del client al laboratori—, amb tauler analític,
  mapa de comptes i segmentació per criteris.
- **Clients** llegits de **FactuSol** (API de DELSOL).
- Accés amb sessió pròpia, comprovada contra Directus.

```bash
npm install
npm run dev     # http://localhost:3000
```

L'accés es comprova contra Directus (`DIRECTUS_URL`). Sense aquesta variable,
el portal cau a les credencials locals `PORTAL_USUARI` / `PORTAL_CONTRASENYA`,
que és la sortida d'emergència mentre dura la migració.

## Estructura

El codi va per capes, i cada una només pot mirar cap avall. La regla curta: la
presentació no coneix cap sistema extern; qui hi parla és `apis/`, i el pont
entre les dues coses és `serveis/`.

```
app/          Presentació · rutes, pàgines i accions de servidor (Next)
components/   Presentació · interfície i gràfics
serveis/      Casos d'ús · l'única porta que la presentació pot travessar
  identitat.ts    qui pot entrar (Directus o credencials locals)
  clients.ts      dades de clients: tria entre rèplica, demo i ERP
  configuracio.ts llegir, desar i comprovar la connexió amb l'ERP
apis/         Sistemes externs i magatzems
  directus/       identitat, sempre des del servidor
  factusol/       client de l'API de DELSOL
  sqlite/         configuració local del portal
domini/       Tipus i càlcul pur, sense entrada ni sortida
  tipus.ts        les entitats que circulen pel portal
  analitica.ts    agregacions dels taulers comercial i de vendes
  crm-analitica.ts agregacions del CRM
lib/          Transversal · sessió signada, format i navegació
middleware.ts Protegeix les rutes del portal
```

Qui pot importar què:

| Capa | Pot importar |
| --- | --- |
| `app/`, `components/` | `serveis/`, `domini/`, `lib/` |
| `serveis/` | `apis/`, `domini/`, `lib/` |
| `apis/` | `domini/`, `lib/` |
| `domini/` | res: és càlcul pur |

Si una pantalla necessita una dada nova, el camí és afegir-la a `serveis/`, no
importar `apis/` des de la pàgina. És el que farà possible canviar l'origen de
les dades —de l'API a la rèplica— sense tocar cap pantalla.

## Sincronització amb FactuSol

La primera pestanya de **Configuració** és la sincronització global: s'hi tria
quines taules de l'ERP es volen portar (clients, proveïdors, articles,
albarans) i el portal les fa en aquest ordre, una darrere l'altra, perquè cada
una apunta a l'anterior. Les altres pestanyes són els **resultats** de cada
taula: la darrera passada amb detall, el que faria la propera, les fitxes que
només són al portal, l'historial i la taula de l'ERP en cru. La programació de
totes les taules és un sol formulari, a la pestanya global.

Cada passada es **veu en viu**. El botó obre un POST a `/api/sincronitzacio`
que fa la passada dins de la mateixa petició —a Cloud Run és el que garanteix
CPU— i hi va escrivint una línia JSON per cada canvi (`EstatEnViu`:
fase, detall, fets de total, comptadors, errors) i un pols cada cinc segons.
La cua la porta el navegador: una taula per petició, amb el seu temps sencer.
Si es recarrega la pàgina, o la passada l'ha engegat el programador o una
altra instància, el GET s'hi enganxa: per la memòria del procés si és aquí, i
si no pel registre de Directus, on el `Seguiment`
(`serveis/sincronitzacio-seguiment.ts`) desa fase i progrés cada pocs segons.
La pantalla diu quant fa que el servidor no diu res i, si el flux es talla,
s'hi torna a enganxar sola.

Un lot que Directus **no accepta** no tomba la passada: si és una caiguda
passatgera es reintenta un cop; si és un error de dades (4xx), el lot es
parteix per la meitat fins a aïllar la fila que no val, que queda anotada al
registre (`errors`, amb codi, nom, operació i motiu) i la passada acaba com a
**parcial**. Passats dos-cents errors s'atura: ja no és cosa de les dades.
Una passada «en curs» que no dona senyals de vida en sis minuts es tanca com
a interrompuda, dient on s'havia quedat.

## Tauler de CRM

Fet amb **Highcharts** (`highcharts` + `highcharts-react-official`), amb tema
propi a `components/grafics/tema.ts`. Els mòduls són UMD i **peten si
s'executen al render de servidor**, així que `components/grafics/Grafic.tsx`
els carrega amb `next/dynamic` i `ssr: false`; el contenidor reserva l'alçada
perquè no hi hagi salt de maqueta.

Dotze KPI (pipeline obert i ponderat, conversió, cicle de venda, leads nous,
visites i presentacions, activitat total, contactes per oportunitat, valor mitjà,
velocitat del pipeline, pas a proposta i tasques vençudes) i deu gràfics, més
un mapa de calor d'intensitat d'activitat per comercial i mes. Les agregacions
són funcions pures a `domini/crm-analitica.ts`.

> Highcharts és de pagament per a ús comercial. Per a un desplegament real cal
> la llicència corresponent; vegeu <https://highcharts.com/license>.

## Selector de productes

El punt de menú **Selector de productes** és un configurador que actua com una
cistella de la compra: a l'esquerra els **criteris de selecció**, al mig els
productes del catàleg que els compleixen i a la dreta la **cistella**: només
quins productes, sense quantitats. Els criteris són les característiques dels
articles de FactuSol (les mateixes que filtren la pantalla d'Articles: tipus,
varietat, productor, anyada, regió, zona, format i proveïdor), més la cerca de
text i «només amb foto»; aquí cada característica admet més d'un valor («negre
o blanc»), i cada opció diu quants productes hi quedarien. «Afegeix-los tots» posa a
la cistella tots els productes trobats.

La cistella es desa com a **plantilla** (`crm_plantilles_productes`, amb els
criteris en JSON, i una línia per producte a `crm_plantilles_productes_linies`; la
columna `quantitat` hi queda, però ja no es fa servir), i una plantilla es torna a carregar, s'actualitza
o s'esborra des del mateix desplegable. Les plantilles són de la casa: les veu
i les pot tocar tothom. Si un producte d'una plantilla ja no és al catàleg, la
cistella es carrega sense i la pantalla ho diu.

La pàgina **recorda la tria** (la cistella, la plantilla carregada, els criteris,
els clients i leads, el dia de visita i l'ordre): anar a una altra pantalla i
tornar-hi, o recarregar, la deixa tal com estava. S'oblida en tancar la sessió o
la pestanya, perquè va a `sessionStorage` (vegeu `lib/vistes-recordades.ts`), i
cada pestanya té la seva. L'estoc, els preus, els presentacions i les activitats del dia
no es recorden: es tornen a llegir. El configurador en modal d'una activitat no
recorda res.

Amb **Tria clients** s'hi posen un o més clients, o un segment sencer, amb
el modal de clients del CRM; amb **Dia de visita** s'obre el calendari del
Planner en un modal (per mes o per setmana, amb les visites de cada dia
repartides per segment; `/api/crm/agenda`) i tocar un dia hi posa d'un cop els
clients de les activitats d'aquell dia (`/api/crm/clients-del-dia`, amb la
mateixa visibilitat que l'agenda: les de cadascú, o totes si és administrador). Llavors cada producte diu si **ja l'han presentat**:
amb un client, «Presentat el <data>»; amb diversos, «Presentat per <client>» si és
un de sol, i si no «Presentat per 2 de 3» o «Presentat per tots». La marca es toca i
desplega sota el producte la llista dels clients triats: els que sí, amb la data (i
les unitats, si és una compra), i els que no, en gris. Els presentacions surten de `crm_activitats_productes`
(`/api/crm/productes-dels-clients`), de les activitats de tothom: que un client ja ha
presentat un producte és un fet del client, no del comercial. També diu si ja l'han **comprat**: de les
línies dels albarans de venda (`crm_albarans_linies`, aquest exercici i el
passat), amb la data del darrer albarà i les unitats. Entre els criteris de
l'esquerra n'hi ha dos que es miren respecte als clients triats, **Presentat** i
**Comprat** (tant si com no, que no ha presentat cap, que n'ha presentat algun; no
hi ha «que han presentat tots»: entre clients no es fa cap I);
sense clients queden en gris i no filtren. Els clients triats no es desen a la
plantilla.

Els productes **històrics** (descatalogats o no disponibles a FactuSol) no surten si
no es marca la casella **Històrics**, que els ensenya tots. L'excepció són els
que algun dels clients triats ha presentat o comprat: aquests surten amb la casella
desmarcada, i arriben amb els presentacions i les compres, sense baixar els milers
d'històrics que hi ha. Sense clients, cap. Com que les compres venen dels
albarans copiats, un producte comprat abans de l'exercici passat no hi compta.

Amb **Tria leads** s'hi posen també leads, i el dia de visita porta els leads
d'aquell dia i n'hi pot posar els productes: cada producte diu què ha presentat el lead (de
les seves activitats), i la fulla de productes surt amb el seu nom i la tarifa de
venda al major, perquè encara no en té de pròpia. Un lead no té compres. La
fitxa del lead té una secció **Productes** amb el que ha presentat i un botó que obre
una activitat amb productes ja lligada al lead. Els productes sempre van amb una
activitat: no hi ha cap tria de productes solta.

Quan un lead es **converteix** (estat «Convertit» i «Client resultant»), en
desar-lo les seves **activitats i els seus To-Do passen al client**: surten a la
seva fitxa, compten per a la periodicitat i la darrera visita, i l'**històric de
productes** arriba a la secció de productes (on les activitats ho diuen, «quan era lead»)
i a les marques i el criteri de **Presentat** del selector. No es mouen: porten el
client sense deixar de portar el lead (`passaDelLeadAlClient` a
`serveis/crm-manteniment.ts`, `domini/crm-conversio.ts`), i és l'únic cas en què
una activitat porta tots dos. Si es canvia el client resultant, el segueixen, i
si es desfà la conversió, tornen a ser només del lead; tornar-ho a desar no
canvia res. L'agent de les activitats passa a ser el del client. Una activitat
que s'apunti després a un lead ja convertit també surt amb el client. Els
contactes i les oportunitats del lead no passen.

Cada producte diu també quin **estoc** en tenim, en viu de FactuSol: la marca
«Estoc 153» és el disponible (DISSTO de F_STO, l'actual menys el que ja està
compromès en comandes) sumant tots els magatzems, i si l'actual és un altre
número, «Estoc 153 · actual 159». Tocar-la desplega el desglòs per magatzem
(F_ALM: General, Sant Bartomeu de Grau, els laboratoris…) amb les dues xifres. Un
producte sense res enlloc diu «Sense estoc». Entre els criteris n'hi ha un d'**Estoc**
(tant si en tenim com si no, només amb estoc disponible, només sense). L'estoc
es llegeix a part del catàleg (`/api/crm/estoc-productes`, `estocDelCataleg` a
`serveis/crm-productes.ts`, agregat a `domini/estoc-productes.ts`): si l'API de DELSOL
triga o falla, el selector va igual, sense estoc, i el criteri queda en gris
dient per què.

El mateix configurador s'obre **en modal des del formulari d'una activitat**
(botó «Configurador», al costat del camp de productes): comença amb els productes que
l'activitat ja té i amb el client de l'activitat ja triat (el que es visita:
així cada producte diu de seguida si ja l'ha presentat o comprat), i «Aplica a
l'activitat» els hi torna. L'activitat només
guarda quins productes són (`crm_activitats_productes`).

El catàleg sencer viatja al navegador d'un cop (`/api/crm/cataleg-productes`) i el
filtrat, els comptes de cada opció i la cistella són càlcul pur a
`domini/cistella-productes.ts`; les plantilles van per `/api/crm/plantilles-productes`
i `serveis/plantilles-productes.ts`. Al telèfon, els criteris i la cistella es
pleguen darrere d'un botó cada un.

## Agenda d'avui

La segona pestanya del CRM, **Avui**, és l'agenda del dia de qui té la sessió
oberta: una sola columna, per ordre d'hora, amb el que fa falta a la carretera.
De cada visita se'n veu l'hora —i la de plegar, si porta durada—, qui es
visita i les seves lletres (categoria i potencial), el tipus, el segment amb el seu color, la població,
el contacte per qui s'ha de preguntar i el telèfon, que al mòbil és un enllaç
`tel:` i marca directament. Del que ja s'ha fet en surt el resultat; del que
queda, el proper pas.

A diferència del Planner, que és el calendari de la casa, aquí només hi surt el
que porta un mateix: les activitats es demanen ja filtrades per `comercial` i
les tasques per `responsable`. Amb les credencials locals no hi ha cap id de
Directus a qui lligar-les i surt l'agenda de tothom, i la capçalera ho diu.

Una ratlla marca **on som ara** i separa el que ja ha passat del que queda per
fer; les visites passades queden apagades. Si el compte té horari comercial
informat i la visita hi cau fora, surt l'avís «fora d'horari» o «dia
bloquejat», el mateix que a les rondes d'un segment. Al costat hi ha les
**tasques que vencen avui**, ordenades per prioritat i amb les tancades al
final; aquí només s'hi recorden, i l'enllaç del costat porta a la pantalla de
**To-Do**, on es marquen i es veu tot el que queda.

Clicar una visita obre la fitxa damunt de l'agenda, i el «+ Nova activitat»
n'obre una de nova a la propera hora en punt. La pestanya porta el comptador
d'activitats d'avui, així que des de qualsevol vista del CRM ja es veu si hi ha
res al dia.

El repartiment i les hores són càlcul pur a `domini/crm-avui.ts`. Com al
Planner, la part delicada és el fus: el tram que es demana a Directus es deriva
de la mitjanit d'aquí i no de la del servidor, que a Cloud Run va en UTC, de
manera que és exacte i no li cal cap coixí.

## Planner

La pestanya **Planner** és el calendari mensual de **totes** les activitats, les
de tothom, pensat per preparar la ruta —l'agenda d'**Avui** és la mirada curta i
personal del mateix material: dins de cada dia les visites es reparteixen **per
segment**, amb el nom del segment de rètol i, a sota, qui s'hi visita i a quina
hora. Cada segment té el seu color, que li ve de l'ordre d'alta i no del nom,
de manera que donar d'alta un segment nou no fa canviar el color dels que ja hi
eren. Com que els segments es defineixen amb variables del compte, una activitat
que encara penja d'un lead surt sota «Sense segment».

De cada visita se'n veu l'hora, qui es visita i les seves **lletres** (d'A a E,
les del compte: primer la categoria i després el potencial); l'assumpte i el
tipus d'activitat queden al globus d'ajuda.

A la capçalera es tria el **representant comercial**: els agents de FactuSol
(F_AGE, copiats a `crm_agents`), no els usuaris del portal. Una activitat porta
l'agent que hereta del seu client o lead (`agent`), i el calendari es filtra
per aquest camp, així que l'agenda que surt és la de la cartera que porta cada
agent a l'ERP. Per defecte hi són tots. La tria va a l'adreça (`c`, l'id de
l'agent) i es conserva en moure's pel calendari i en obrir una fitxa; un valor
que no és cap agent compta com a tots. Per sobre d'això hi ha l'abast de la
sessió: qui no és administrador només veu les activitats que porta ell i les
que no porta ningú.

Es pot mirar **per mes o per setmana**, amb un selector a la capçalera. A la
setmana hi ha alçada de sobres, així que no s'hi resumeix res i els noms
s'escriuen sencers en dues línies; al mes, cada casella ensenya fins a quatre
visites i el que sobra queda com a «+N més». Els dies sense res diuen «Lliure».

El «+» d'un dia obre una activitat nova amb la data ja posada, i clicar una
visita obre la fitxa damunt del calendari sense perdre ni el mes ni la setmana
on eres. Per sota de tauleta, on set columnes no es llegeixen, tots dos modes
es tornen una agenda per dies amb la mateixa divisió per zones.

La graella i el repartiment són funcions pures a `domini/crm-planner.ts`. La
part delicada és el fus: Directus desa les marques en UTC i el servei corre en
UTC a Cloud Run, així que una visita de les onze del vespre cauria el dia
següent si es llegís en cru. El dia i l'hora es deriven sempre amb
`Europe/Madrid`, i la consulta demana un dia de coixí a cada banda de la
graella per no perdre les de primera i última hora.

## To-Do

La pantalla **To-Do**, just sota l'Agenda al menú, és tot el que queda per fer
de tots els clients de cop. Un To-Do neix en tancar una activitat (vegeu
«Tancar una activitat i els deures que deixa») o s'apunta a mà a la fitxa del
client, i hi viu fins que es marca; aquí es miren tots junts i la pregunta
canvia: ja no és «què li dec a aquest client» sinó «què em toca fer primer».

De cada To-Do se'n veu el text, la prioritat i quan venç («Venç avui», «Vençut
fa 3 dies», «Venç dijous 30/10»); **de qui és** —el client amb les lletres, la
facturació i la «A» dels atributs com a la resta de llistes, o el lead—, amb la
població i el telèfon, que marca directament; i **d'on surt**: l'activitat que
el va deixar, amb el tipus, el dia i com va anar, i l'oportunitat si en té. El
client obre la seva fitxa i l'activitat s'obre en panell a sobre de la llista,
com a l'agenda. Un To-Do fet a mà a Directus, sense activitat, també hi surt i
ho diu.

Van agrupats **per venciment** —vençuts, avui, aquesta setmana, més endavant,
sense venciment— i, dins de cada grup, mana la prioritat i després la data. O
**per client**, que és com es despatxen a la carretera: el client amb més pressa
al davant i tot el seu de cop. La capçalera resumeix quants n'hi ha de cada
termini i porta a cada grup. Amb «Mostra els fets» surten també els darrers
tancats, el més recent primer.

La casella marca el To-Do de seguida i s'espera després; si no ha colat, torna
on era i diu per què. La fila **no se'n va** en marcar-la: queda ratllada al seu
lloc i la mateixa casella la desfà, que una relliscada s'ha de poder arreglar.
Per això l'acció (`marcaToDoAccio`) no refresca la pantalla: la resta de vistes
ja ho veuen al dia a la propera visita.

Com a Avui, qui només veu les seves activitats hi té els seus To-Do (els que
té de `responsable`) i els que no té ningú; qui ho veu tot —un administrador,
o les credencials locals— hi té els de tothom, amb el nom de cadascú a cada
fila, i pot triar-ne els d'una persona amb el mateix desplegable del Planner.
El punt del menú porta el comptador de pendents.

El càlcul (terminis, ordre, grups, resum) és pur a `domini/crm-todo.ts`; les
consultes a Directus són a `apis/directus/crm.ts` (`llistaToDosPendents`,
`llistaToDosFets`) i el muntatge a `serveis/crm-deures.ts` (`toDosPerFer`).

## Tancar una activitat, i els ToDos que en surten

Tancar una activitat no és omplir una casella: és un pas amb el seu moment. Per
això el **resultat** ja no surt com a camp del formulari i, al seu lloc, la
fitxa d'una activitat oberta porta el botó **«Tanca l'activitat»**. En prémer-lo
es demanen dues coses: com ha anat —Positiu, Neutre, Negatiu o Sense resposta—
i els **ToDos** que deixa.

Els ToDos són **N i no un**: en sortir d'una visita se'n recorden tres o quatre
de cop, i s'escriuen com a etiquetes, d'una en una amb la tecla de retorn. Els
repetits no s'hi colen i n'hi caben fins a vint. Opcionalment se'ls posa un
venciment comú.

No es desen en cap camp nou: **cada ToDo és una tasca del CRM** (`crm_tasques`)
penjada de l'activitat que la va demanar i del compte a qui toca. És el que fa
que després es puguin arrossegar.

I aquí és on serveixen: quan s'obre la **propera activitat del mateix compte**,
la fitxa ensenya els **deures pendents** que arrossega —de l'activitat anterior
o de la de fa tres mesos, mentre segueixin per fer— i es marquen allà mateix amb
una casella. Marcar-ne un el deixa fet a Directus amb el dia que s'ha tancat; si
la crida falla, la casella torna on era en comptes de fer creure que s'ha desat.
Els de l'activitat que s'està mirant no es barregen amb els que arrossega: van a
part, com a «ToDos que ha deixat».

Una activitat tancada ensenya el segell «Tancada · Positiu» i es pot **tornar a
obrir**; els deures que va deixar es queden on són.

Que el `resultat` no el toqui el formulari es fa amb la marca `extern` d'un camp
a `domini/crm-fitxes.ts`: un camp amb amo propi no es pinta ni es desa, perquè
si es desés, desar la fitxa desfaria el que ha fet l'acció de tancar.

D'una activitat **nova** només se'n saben els deures si el compte ja ve posat
—quan es dona d'alta des de la fitxa del compte—: mentre s'està triant al
desplegable, el servidor encara no sap de qui parlem, i llavors la secció surt
en desar.

## Desplegables que depenen d'un altre camp

El **contacte** d'una activitat només ofereix la gent del compte que hi ha
triat, no els contactes de tota la casa: en una visita s'apunta amb qui s'ha
parlat, i una llista de tots els contactes del CRM no ajuda a trobar-lo.

Es declara a la fitxa amb `filtradaPer`, que és una llista de camps del mateix
formulari: es proven en ordre i mana el primer que tingui valor, perquè un
contacte penja del compte i, si encara no és client, del lead. El nom del camp
d'aquí ha de ser el mateix que el de la fitxa relacionada, que és el que es
filtra a Directus.

El desplegable se n'assabenta quan el compte canvia: torna a demanar la llista i
**deixa anar el que hi havia triat**, que era d'un altre compte. Mentre no se
sap de qui són, el camp queda bloquejat i diu quins camps falten, en comptes
d'oferir-ho tot. La cerca que passa per `/api/crm/relacions` hi arrossega el
filtre, i la ruta comprova que el camp existeixi de debò a la fitxa que es
consulta: el que arriba del navegador no mana sobre quina consulta es munta.

El que la fitxa ja tenia desat no es perd mai encara que no encaixi amb el
filtre —es demana per id, a part— perquè val més veure-ho que no pas que el
camp surti buit.

## Oberta o tancada, a la vista

El Planner i l'agenda d'avui diuen sempre si una activitat és **oberta** o
**tancada**, perquè en un calendari de ruta el que es ve a buscar és què queda
per fer. El vocabulari és el mateix a tot arreu i viu a
`components/crm/EstatActivitat.tsx`: si cada pantalla s'ho pintés a la seva
manera, el mateix desenllaç semblaria una cosa diferent segons on es miri.

Al **Planner**, on una casella de mes no admet cap etiqueta, el senyal és d'un
sol caràcter davant de l'hora —`○` oberta, `✓` tancada— i les tancades van
apagades, de manera que el que ressalta és el que queda per fer. La llegenda ho
explica i el globus d'ajuda hi diu el desenllaç sencer. La capçalera compta les
que ja han passat i segueixen obertes: «3 per tancar».

A **Avui** hi ha espai per a una etiqueta, i n'hi ha tres: el desenllaç amb el
seu color quan és tancada, «Per tancar» en ambre quan ja ha passat i ningú no
l'ha tancada, i «Oberta» quan encara ha de venir. La capçalera també en porta el
recompte.

## Deures des de la fitxa del compte

La fitxa d'un compte té pestanya de **Deures**: tot el que li han deixat les
seves activitats en tancar-se, junt i vingui d'on vingui. El comptador de la
pestanya són els que queden per fer, que és el que s'hi ve a mirar; els ja fets
van plegats en un desplegable a sota, perquè oberts taparien la feina viva. Es
marquen des d'allà mateix.

S'activa amb `ambDeures` a la fitxa. Aquí no s'hi tanca res ni s'hi afegeixen
ToDos nous: això passa en tancar una activitat, que és quan se sap què queda.

Amb aquesta ja són cinc seccions, i al telèfon no hi caben en una fila: es
pleguen en pastilles repartides en dues files en comptes de rascar de costat. A
partir de tauleta tornen a ser la fila de pestanyes subratllades de sempre.

## La capçalera del panell no es mou

Sortir del panell es diu **«Tanca»** a totes les seccions, també a la de dades:
no cal dir-ne «Cancel·la» quan al costat hi ha un «Desa» que és qui guarda.
«Cancel·la» queda només per a una fitxa oberta a dins d'una secció, on de debò
cancel·la aquella i torna enrere sense tancar el panell.

Perquè el títol i la filera de seccions no pugin i baixin en canviar de
pestanya, **la fila d'accions té l'alçada del botó reservada sempre**, hi hagi
«Desa» o no i també mentre es confirma un esborrat, que no en té cap. Abans la
fila creixia amb el que hi havia a dins —32px amb botó, 20px amb només l'enllaç,
0 confirmant— i això movia tot el que hi havia a sota 19px amunt i avall.

## Res no rasca de costat

És una regla de tot el portal, i no només al telèfon: cap contenidor no ha de
demanar desplaçament horitzontal. Tampoc no s'hi declara `overflow-x` on no
calgui, perquè amb les barres del sistema configurades com a sempre visibles la
franja grisa hi surt encara que no hi hagi res per rascar.

Per això les dues fileres de pestanyes —les vistes del CRM i les seccions d'una
fitxa— **embolcallen** en comptes de rascar: onze vistes no caben en una fila
fins ben passats els 1300px, i la barra amagava precisament les últimes. I les
taules dels llistats es pleguen en fitxes fins a tauleta ampla (`md`), amb una
amplada mínima que cap a 1024px amb la barra lateral oberta, on queden uns
720px.

Es comprova mesurant, no llegint CSS: obrint les vistes amb Chrome a amplades
de 320 a 1600 i buscant `scrollWidth > clientWidth` a tot el que tingui
`overflow-x`. Dos paranys: `offsetHeight − clientHeight` també compta els
borders —restar-los abans de dir que hi ha barra— i una fitxa oberta amb
`r=nou` no ensenya cap pestanya, així que amaga justament aquests problemes.

## Horaris del compte

Cada compte porta dos horaris independents —**atenció comercial** i
**entregues**— perquè sovint no coincideixen: es ven al matí i es descarrega a
primera hora. Cadascun és una setmana de set dies i cada dia té els seus
**blocs**, no un sol interval: un compte obre al matí, tanca a dinar i torna a
obrir a la tarda.

A més dels blocs, cada dia té estat: **obert**, **preferent** —on convé posar la
visita— o **bloquejat**, on no s'hi va mai. Un dia obert sense cap bloc no és un
dia tancat: és un dia sense horari informat, i es tracta diferent.

S'edita amb la matriu de `components/crm/MatriuHoraris.tsx`, una fila per dia
amb l'estat i els blocs. Els dies van en files i no en columnes perquè un camp
d'hora no cap en una setena part de l'amplada i perquè un dia pot tenir més
blocs que un altre. Hi ha un ajut que copia el dilluns a tots els feiners, que
és el cas corrent.

El model i el càlcul són purs a `domini/crm-horaris.ts`, i tot el que arriba de
Directus es torna a validar: es descarten els blocs que acaben abans de
començar, les hores mal formades i els estats desconeguts. `disponibilitat`
respon si a una hora d'un dia el compte està obert, tancat, bloquejat o sense
horari; el bloc inclou l'hora d'obrir i exclou la de tancar, perquè a les 13:00
ja és tard.

Això no és dada morta: quan es munta una ronda des d'un segment, cada fila
ensenya els blocs del compte per al dia triat i avisa si l'hora cau **fora
d'horari** o en un **dia bloquejat**.

## Segmentació de comptes

Els comptes no s'etiqueten un per un: es defineixen **segments** amb criteris
sobre les variables del compte, i qui hi encaixa hi entra sol. Un compte que
canvia de població o de categoria canvia de segment sense que ningú el torni a
tocar. S'administren des de la pestanya **Segments** del CRM.

Un segment té nom, codi curt, estat, una **prioritat** —quan un compte encaixa
en més d'un, es queda amb el de número més baix— i la seva llista de condicions,
que es combinen amb «totes» o «alguna».

El constructor de criteris és `components/crm/ConstructorCriteris.tsx`. Les
variables filtrables surten de la mateixa descripció de la fitxa del compte a
`domini/crm-fitxes.ts`, de manera que afegir-hi un camp el fa filtrable sense
tocar res més. Mentre es munta, va preguntant a `/api/crm/segments` qui hi
encaixaria: el recompte es veu sempre i, amb la fletxa, es desplega la llista
sencera de comptes seleccionats. Cada compte s'obre en una pestanya nova, que
si s'obrís aquí es perdria el segment a mig fer.

Al llistat, cada segment es desplega i ensenya els comptes que ha seleccionat
amb el que cal per jutjar el filtre: tipus de client, categoria i potencial, població, comarca,
quantes activitats porta, quan va ser l'última i quantes oportunitats hi té
obertes. Els recomptes els agrega Directus (`aggregate` amb `groupBy`), no es
porten totes les activitats per comptar-les aquí. Al peu es diu quants comptes
no encaixen en cap segment, que és el que se sol oblidar.

### Rondes de visites des d'un segment

Amb el segment desplegat, els comptes es trien amb caselles: la de la capçalera
els marca tots i després se n'exclouen els que calgui. El tipus d'activitat, el
dia i l'assumpte són comuns a la ronda, però **cada compte porta la seva hora**,
en una fila pròpia i en l'ordre de la ruta. Com que omplir-les una per una és
feina, hi ha un ajut que les encadena totes a partir d'una hora d'inici i un
interval, i després es retoquen les que calgui.

Es crea **una activitat per compte**, no una de compartida, perquè cada visita
té la seva hora i el seu resultat. Ho fa `serveis/crm-accions.ts` amb una sola
petició a Directus, i les activitats surten al Planner tot seguit.

Els identificadors venen del navegador, així que es tornen a comprovar contra
els comptes de debò, el tipus contra el vocabulari i la tanda contra un màxim.

> **Hores i fus.** Convertir «2026-11-10T08:30» a un instant no pot dependre
> del fus del servidor, que a Cloud Run va en UTC: les vuit i mitja s'hi
> desarien com les vuit i mitja UTC i el calendari les ensenyaria a les nou i
> mitja. `instantDeLocal` a `domini/crm-planner.ts` fa la conversió amb
> `Europe/Madrid` en dues passades, de manera que també cau bé les nits que es
> canvia l'hora. El formulari de fitxes ara hi passa igualment: abans desava
> les marques amb el fus del servidor.

Un compte surt a tots els segments que compleix, no només al de més prioritat:
al llistat s'està revisant la definició i amagar-ne la meitat enganyaria. La
prioritat només mana quan cal triar-ne un de sol, com al calendari.

L'avaluació és pura, a `domini/crm-segments.ts`, i compara text sense accents ni
majúscules. Els criteris es guarden en un camp JSON de Directus i es tornen a
validar cada vegada que es llegeixen: un camp lliure no és de fiar, encara que
l'hagi escrit el portal. Un segment sense criteris no agrupa ningú, a propòsit.

> La col·lecció anterior `crm_zones` i els camps `zona` de `crm_clients` i
> `crm_leads` segueixen a Directus però el portal ja no els fa servir. Es poden
> esborrar quan es vulgui; no s'ha fet automàticament per no tocar dades.

## Mapa de comptes

La pestanya **Mapa** del CRM situa els comptes sobre OpenStreetMap amb
**Leaflet**, i el mapa s'estira a tot l'espai que queda: a sobre només hi ha la
fila de pastilles del selector i, a sota, una línia plegada amb el que falta per
ubicar. Perquè el mapa pugui créixer, la pàgina del CRM té alçada definida
(`h-full`) i no només mínima.

Les rodones s'agrupen segons el zoom: a poca distància es veuen poques rodones
grosses amb quants comptes hi ha a sota, i en apropar-se es van partint fins que
cada compte és el seu punt, amb les seves dues lletres. Cada punt va del
color del **segment** on encaixa, i els grups es fan dins de cada segment i no
barrejant-los, de manera que una rodona sempre és d'un sol color i el color vol
dir alguna cosa.

El selector de dalt permet triar un segment: els seus comptes queden il·luminats
i la resta es pinten pàl·lids i petits, que hi són per donar context sense robar
l'atenció. La tria es queda al navegador i només repinta; no torna a demanar res
al servidor. En canviar de segment, la vista es reenquadra als seus comptes.

Clicar un compte obre la seva fitxa **damunt del mapa**, sense canviar de vista:
el mapa es queda al darrere amb el zoom on estava, i en tancar la fitxa s'hi
torna. Ho fa el mateix mecanisme que el Planner, que obre activitats sense
sortir del calendari. El segment triat viatja a l'adreça (`seg`), de manera que
també sobreviu a una recàrrega. Un clic en un grup, en canvi, hi acosta el mapa.
L'agrupació és una funció pura a `domini/crm-mapa.ts` (projecció de Mercator i
una graella en píxels), de manera que no depèn de Leaflet i es pot provar sola.

Les coordenades són dos camps de `crm_clients` (`latitud`, `longitud`) i es
poden corregir a mà des de la fitxa. Els comptes que no en tenen s'ubiquen
**sols**, per tandes de sis a `apis/geocodificacio/` (**Nominatim**) que es desen
a Directus: en obrir el mapa (`components/crm/UbicacioAutomatica.tsx`, que el
refresca perquè els punts vagin apareixent), en segon pla des del programador
(després de cada sincronització de clients i, si no, cada 15 minuts) i just
després de desar un client al portal (`ubicaTotsElsPendents`). Les tandes van
en cua dins del procés, de manera que el mapa i el programador no es trepitgen.
Va per tandes perquè la política d'ús de Nominatim demana no passar d'una
consulta per segon i identificar-se amb un User-Agent propi; totes dues coses es
respecten, i una tanda gran deixaria la petició penjada massa estona.

Les **regions** que es dibuixen al mapa es poden desar com a segment per
ubicació. El segment no guarda quins clients hi havia, sinó els contorns (un
criteri `ubicacio` «és dins de», amb cada regió en JSON): qui hi cau es torna a
calcular cada vegada, així que un client que s'hi situï més endavant hi compta
sol. L'única condició és que tingui coordenades, i per això la ubicació no
espera que algú obri el mapa.

La cerca va de l'adreça sencera cap avall fins a la població, i la **comarca**
hi entra pel mig: desfà homònims, que de Sant Martí n'hi ha uns quants.

Cada tanda deixa cada compte resolt o marcat com a fallit, així que els pendents
sempre minven i les rondes s'acaben. Del que falla se'n recorda amb quina adreça
va fallar: no s'hi torna fins que algú la corregeix a la fitxa. Si la cerca no
porta carrer, es descarten els resultats que són carrers: hi ha un «Carrer de
Copenhaguen» a Sabadell que si no s'endevia un compte danès.

Leaflet toca `window` en importar-se, així que `components/crm/MapaComptes.tsx`
el carrega amb `next/dynamic` i `ssr: false`, com els gràfics.

Si Nominatim respon 429, 403 o 503 (limita les consultes de la IP), la tanda
s'atura amb un error visible i **cap compte es marca com a fallit**: no és
culpa de l'adreça. Els fallits de debò viuen en memòria del procés; el botó
«Torna a provar» del mapa (`reprenUbicacioAccio`) els oblida i el mapa reprèn
la ubicació sol.

## Clients (FactuSol)

Els clients es llegeixen de la taula `F_CLI` de FactuSol a través de l'API de
DELSOL. Si falten les credencials o l'API falla, el llistat mostra el motiu en
comptes d'inventar-se fitxes.

Les credencials són **variables d'entorn del servei** (`api_url`,
`api_fabricante`, `api_cliente`, `api_db`, `api_ejercicio`, `api_password`;
vegeu `.env.example`). `api_ejercicio` admet el marcador `<year>` per agafar
l'any en curs. Els noms antics `FACTUSOL_*` encara valen com a alternativa.
El portal no les desa enlloc.

La pantalla de **Configuració** té una pestanya per taula de l'ERP que es
sincronitza i una darrera de «Connexió»:

- **Clients**: la sincronització `F_CLI` → `crm_clients` (vegeu a sota), amb
  el botó de fer-la ara, la programació, l'historial de passades i la taula
  de F_CLI en cru amb què li passarà a cada fitxa.
- **Proveïdors**: el mateix per a `F_PRO` → `crm_proveidors`.
- **Articles**: el mateix per a `F_ART` → `crm_articles`, només amb els actius.
- **Albarans**: el mateix per a `F_ALB` → `crm_albarans`, amb les línies de
  `F_LAL` a `crm_albarans_linies`.
- **Connexió**: estat de les credencials, llista de variables i el botó que
  llança una consulta de prova contra F_CLI i F_PRO.

### Sincronització de clients (FactuSol → Directus)

Va en una sola direcció. Cada passada porta F_CLI sencera, la compara amb els
comptes de Directus per `codi_erp` (CODCLI) i només escriu el que ha canviat,
per lots de 100. La lògica pura és a `domini/sincronitzacio.ts`; qui llegeix i
escriu és `serveis/sincronitzacio.ts`.

- **Amo de cada camp.** Als camps que vénen de FactuSol hi mana FactuSol:
  `nom_comercial` (NOCCLI o, si és buit, NOFCLI), `rao_social`, `nif`,
  `adreca`, `codi_postal`, `poblacio`, `provincia`, `pais`, `telefon` (TELCLI
  o MOVCLI), `correu`, `web`, `tarifa`, `forma_pagament` (descripció de
  F_FPA), `data_alta`, `estat` i `tipus_client`. La resta (categoria, potencial, zona, comercial,
  comarca, horaris, notes, coordenades i tot el que hi penja) és del CRM i no
  es toca mai. Al formulari del portal, els camps de l'ERP d'una fitxa amb
  `font = factusol` es veuen però no s'editen (`deErp` a `crm-fitxes.ts`).
- **Font.** `crm_clients.font` val `factusol` o `portal`. Els comptes creats
  a mà queden com a `portal`; per lligar-ne un a l'ERP n'hi ha prou amb
  posar-li el `codi_erp`: a la propera passada rep les dades i passa a
  `factusol`.
- **Canvis.** FactuSol no té data de modificació fiable, així que es desa a
  `erp_empremta` un resum dels camps de l'ERP i només s'actualitza la fitxa
  quan canvia. Si canvia l'adreça, es buiden les coordenades i, en acabar la
  passada, el programador les torna a calcular en segon pla.
- **País.** PAICLI és un codi numèric ISO 3166-1 («724» és Espanya): es
  converteix al nom (`PAIS_PER_CODI` al domini) perquè la geocodificació i la
  gent l'entenguin. Els codis que no hi són es deixen tal qual.
- **Absents.** Un client que desapareix de F_CLI no s'esborra: rep
  `erp_absent_des_de` i passa a estat baixa.
- **Estat.** ESTCLI és la posició al desplegable «Estado» de la fitxa de
  FactuSol: 0 sense seleccionar, 1 habitual, 2 esporàdic, 3 baixa i 4
  captació. El CRM fa servir aquests mateixos cinc estats (`ESTATS_CLIENT` a
  `domini/factusol-vocabulari.ts`), i el codi en cru es guarda a `erp_estat`.
- **Clients de baixa.** No surten enlloc del portal: les consultes a F_CLI
  porten `ESTCLI <> 3` (llistat i fitxa de Clients, sincronització i prova de
  connexió), així que un client que passa a baixa a l'ERP queda com a absent. Al
  CRM, la fitxa de clients té `excloses` (estat baixa), que apliquen el llistat,
  els desplegables, els comptadors i els segments.
- **Facturació.** Just després de cada passada de clients es porta F_FAC a
  `crm_facturacio`, una fila per client, exercici i mes amb la base imposable
  (BAS1–4FAC, sense IVA; les rectificatives resten) i el nombre de factures. A
  l'exercici en curs, la base hi suma els albarans encara no facturats (F_ALB
  amb `ESTALB = 0`, BAS1–4ALB, al mes de l'albarà); els anteriors només porten
  factures, de manera que l'any en curs es compara amb factures dels anteriors.
  FactuSol té una base de dades per exercici, així que es llegeixen d'un en un
  els tres de la finestra (dos enrere i l'actual), agrupats per client i mes. La
  col·lecció queda igual que l'ERP: es creen, s'actualitzen i s'esborren mesos,
  i un exercici que no respon es deixa com estava. Només hi entren clients del
  CRM que no són de baixa. La fitxa del client (pestanya Facturació, i el plafó
  de Clients) calcula en el moment els dos exercicis sencers i l'acumulat de
  gener al mes passat dels tres anys (`domini/facturacio.ts`).
- **Resum a la llista de clients.** A cada passada també es desa a cada client
  un resum (`facturacio_*`: anys sencers, acumulat del mateix període dels tres
  anys, variació i tendència), només on ha canviat. La llista del CRM el pinta
  a la columna Facturació amb tres mini-barres i una etiqueta, l'ordena per
  l'acumulat d'enguany i el filtra per tendència: creix o baixa (±10 %),
  estable, nou, perdut o sense facturació (`domini/facturacio-tendencia.ts`).
  Com que el període avança amb el mes, convé tenir la sincronització diària.
- **Fons de les files de clients.** A la llista de clients, el color de fons de
  cada fila no ve de la facturació ni de la periodicitat: diu quant fa que no
  s'hi va. Es mira la darrera activitat del client amb data fins avui (les
  programades més endavant no compten) i es pinta per trams de tres mesos:
  verd fins a tres, groc de tres a sis, taronja de sis a nou i granat de nou
  en amunt o si no en té cap (`domini/crm-visites.ts`). En passar per sobre de
  la fila es llegeix la data exacta, i a dalt de la llista hi ha la llegenda.
  No es desa res: es calcula a cada càrrega amb una agregació de Directus.
- **Categoria i potencial.** Són dues lletres d'A a E que van juntes al costat
  del nom del client a totes les llistes, en aquest ordre. La **categoria** la
  calcula el portal: surt de la facturació de l'exercici passat sencer i de les
  franges de `crm_categories` (cada lletra comença a partir d'un import; per
  defecte E 0, D 1.500, C 2.500, B 5.000 i A 7.500 €). Es desa al camp
  `categoria` del client amb el resum de facturació, així que es veu igual a
  totes les pantalles. Les franges es canvien a Configuració › Valors CRM, que
  en desar recalcula tots els clients (`domini/crm-categoria.ts`). A la fitxa
  es veu però no s'edita (`calculat` a `crm-fitxes.ts`). El **potencial** és
  manual: el posa qui porta el compte, a la fitxa del client, i el portal no
  el toca mai.
- **Tipus d'activitat.** Són a `crm_tipus_activitat` i es creen i es canvien a
  Configuració › Valors CRM. L'activitat desa el `valor` del tipus, que surt del
  nom en crear-lo i ja no canvia, així que canviar el nom no toca cap activitat.
  Cada tipus diu si compta com a visita al tauler i si porta productes i laboratori al
  formulari. Un de desactivat deixa de sortir en crear activitats, però les que
  el tenen el conserven; només s'esborren els creats aquí que no tenen cap
  activitat. Els diversos clients o laboratoris d'una mateixa visita van lligats als
  valors `visita_laboratori` i `visita_laboratoris_client`. Si Directus no té la taula,
  el CRM fa servir els de partida (`domini/crm-tipus-activitat.ts`). Per crear
  la taula en un Directus en marxa, `scripts/crm-tipus-activitat.mjs`.
- **Tipus de client.** Com a FactuSol, és una taula a part: F_TCL es copia a
  `crm_tipus_client` al principi de cada passada de clients (mateix mecanisme,
  lligat per `codi_erp`), i `crm_clients.tipus_client` hi apunta a partir de
  TCLCLI. Un codi que F_TCL no té deixa la relació buida; el codi en cru queda
  a `erp_tipus_client`. Leads i oportunitats apunten a la mateixa taula. Quins
  tipus surten als desplegables es tria a Directus amb `usat_crm` («Es fa
  servir al CRM»); la taula sempre és sencera.
- **Agent comercial.** Igual que el tipus: F_AGE es copia a `crm_agents` al
  principi de cada passada de clients, i `crm_clients.agent` hi apunta a partir
  d'AGECLI (el 0 és «sense agent»; el codi en cru queda a `erp_agent`). Cada
  usuari de Directus té un camp `agent` que es tria a la pantalla d'Usuaris; un
  agent només pot ser d'un compte. El llistat de clients, el selector de
  clients i els segments hi filtren.
- **Registre.** Cada passada queda a `crm_sync_execucions` (inici, fi,
  comptadors i error, si n'hi ha), amb el nom de la taula. Un bloqueig en
  memòria per taula evita dues passades alhora de la mateixa.

### Laboratoris: els proveïdors de l'ERP

Els laboratoris de qui es compra no són una taula del portal: són els proveïdors de
FactuSol. Hi havia una `crm_laboratoris` pròpia amb quatre fitxes de mostra i s'ha
retirat (`scripts/crm-laboratoris-erp.mjs`), de manera que ara:

- El menú els porta a **ERP › Laboratoris**, que és la fitxa `proveidors` de
  `domini/crm-fitxes.ts` sobre `crm_proveidors`. La clau interna és
  «proveidors», que és el que són a l'ERP, però a la gent se'ls ensenya com a
  laboratoris, que és com se'n parla a la casa.
- El camp **laboratori** d'una activitat hi apunta, i el proveïdor ensenya les
  seves visites a la pestanya d'activitats.
- Com que en són centenars, el camp no ofereix cap llista: es cerca
  (`components/crm/SelectorLaboratori.tsx`, servit per `/api/crm/laboratoris`). Cerca
  alhora per nom, raó social, NIF, població, província, correu i codi d'ERP, i
  escurça per tipus i per província. El codi es prova per igualtat i només si
  el terme és tot xifres, perquè `_icontains` contra una columna de números
  peta a Directus.
- El cercador va en un desplegable ancorat al camp, no en una finestra que tapi
  la pantalla: s'obre dins del panell de la fitxa, que ja és una capa, i una
  segona capa a sobre feia l'efecte que s'obria tot de nou. Si a sota no hi cap
  —el camp és avall de tot del formulari, o s'és al telèfon— s'obre cap amunt.

### Sincronització de proveïdors (FactuSol → Directus)

`F_PRO` → `crm_proveidors`, amb el mateix mecanisme que els clients: mateixa
empremta, mateixa marxa enrere i mateixa programació, només que amb un altre
mapatge de camps.

**Només els homologats.** La consulta filtra per `HOMPRO = 1`, que és la
casella «Proveedor homologado» de la pestanya «Otros datos» de FactuSol: dels
651 proveïdors de la taula, 34 ho estan, i són exactament els laboratoris de qui es
compra (tots amb compte comptable 600). La resta són transportistes, gestories
i subministraments, que no tenen res a veure amb l'acció comercial. Un laboratori
que deixi d'estar homologat no s'esborra: entra per la via dels absents i
conserva tot el que hi penja.

La taula porta la meitat de columnes buides; només es copien les que tenen
dades:

- **Amo de cada camp.** `nom_comercial` (NOCPRO o, si és buit, NOFPRO),
  `rao_social`, `nif`, `tipus`, `adreca`, `codi_postal`, `poblacio`,
  `provincia`, `pais`, `telefon` (TELPRO o MOVPRO), `mobil`, `correu`, `web`,
  `persona_contacte`, `forma_pagament` (descripció de F_FPA), `iban` (SWFPRO),
  `bic` (SWIPRO), `banc`, `compte_comptable` (CCEPRO), `retencio` (RETPRO),
  `descompte` (DP1PRO), `observacions` (OBSPRO), `data_alta`,
  `erp_modificat_el` (FUMPRO) i `estat`. Les `notes` són del portal i no es
  toquen mai.
- **Tipus.** TIPPRO separa qui ven mercaderia (`proveidor`, 503 fitxes) de qui
  ven serveis (`creditor`, 148). Es veu al compte comptable: els primers van al
  600 i els segons, al 62x, que a la comptabilitat espanyola són creditors.
- **Estat.** ESTPRO 0 és actiu i 1 és baixa, com a F_CLI; la instal·lació
  també en té de 3, que es consideren inactius.
- **Sense mapa.** Els proveïdors no es geocodifiquen: canviar-los l'adreça no
  buida cap coordenada, perquè no en tenen.

### Sincronització d'articles (FactuSol → Directus)

`F_ART` → `crm_articles`, amb el mateix mecanisme. Es llegeix a ERP › Articles
i a la fitxa de cada laboratori.

- **Només els actius.** La consulta deixa fora els articles amb la casella de
  descatalogat (`DSCART`) o la de no permetre'n l'ús (`NPUART`) marcades
  (`MARQUES_ARTICLE_INACTIU` a `domini/factusol-vocabulari.ts`). Un article
  que hi passa entra per la via dels absents, i el llistat no l'ensenya. La
  pestanya de Configuració diu quants en treu cada marca.
- **Codi de text.** CODART no és numèric com CODCLI o CODPRO: la comparació
  lliga pel codi en text, i així es conserven els zeros del davant.
- **Camps.** `nom` (DESART), `codi_barres` (EANART), `familia` (descripció de
  F_FAM) i `erp_familia` (FAMART), `laboratori` (PHAART, el proveïdor habitual,
  lligat a `crm_proveidors` si és dels homologats) i `erp_proveidor`,
  `referencia_proveidor` (REFART) i `data_alta`. Les `notes` són del portal.
- **Ordre.** Va després dels proveïdors: els articles apunten als laboratoris que
  aquella passada ja ha copiat.
- **Fotos.** IMGART és el nom del fitxer de la foto i porta la data, així que
  només canvia quan canvia la foto: es copia a `erp_imatge` com un camp més.
  Després de la passada, `serveis/imatges-articles.ts` baixa amb la crida
  `ArticulosImagen` de l'API les que no coincideixen amb `imatge_copiada_de`, les
  puja a la carpeta «Articles de FactuSol» de Directus (que les desa a Cloud
  Storage) i esborra la que substitueixen. Com a molt 150 per passada: la
  primera càrrega es fa en unes quantes. El navegador les demana a
  `/api/articles/<id>/imatge` (`mida=petita` per a les miniatures, que
  transforma Directus).

### Sincronització d'albarans (FactuSol → Directus)

`F_ALB` → `crm_albarans` i `F_LAL` → `crm_albarans_linies`, per a la pestanya
Facturació de la fitxa de client, que en llista els albarans (10 per pàgina,
els més nous primer) amb les línies i la foto de l'article.

- **Dos exercicis.** L'actual i el passat (`ANYS_ENRERE_ALBARANS` a
  `domini/albarans.ts`), cadascun llegit de la seva base de dades com la
  facturació. Si un exercici no respon, la passada s'atura: seguir marcaria
  absents tots els seus albarans.
- **Codi amb l'exercici.** El número d'albarà només és únic dins de l'any: el
  `codi_erp` és «exercici-sèrie-número» i el de la línia hi afegeix la posició.
- **Només clients del CRM.** Un albarà d'un client de baixa, o que no és a la
  còpia, no es porta (`admet` a la definició); si ja hi era, queda absent.
- **Línies.** Van just després de les capçaleres, a la mateixa passada. Cada
  una apunta al seu albarà i, si és d'un article actiu, a l'article. Es
  guarden la descripció de l'albarà, quantitat, preu, descompte i import sense
  IVA.
- **Temps.** Cloud Run talla la petició als 300 s, i la passada manual hi corre
  a dins: passats 180 s (`TEMPS_D_ESCRIPTURA_MS`) cap passada, de cap taula,
  comença un lot més, i el que queda es fa a la següent (el registre diu
  quantes files en queden). La primera càrrega de línies en demana unes quantes.
  Lots de 250: un de 500 va fer esperar Directus més de 30 s.
- **Sense historial.** `crm_albarans` i `crm_albarans_linies` tenen
  `accountability: null`: Directus no hi desa activitat ni revisions, que per a
  cada fila escrita eren dues insercions més. La història és a FactuSol.
- **Una passada alhora.** Cloud Run pot tenir més d'una instància i el bloqueig
  en memòria no les veu: abans de començar es mira el registre de Directus. Una
  passada «en curs» de fa més de 6 minuts la va tallar el servidor, i es tanca
  com a interrompuda.

**Programació.** El Next corre en un contenidor permanent, així que el
rellotge viu dins del procés: `instrumentation.ts` arrenca
`lib/programador.ts`, que cada minut demana al servei si toca fer passada. La
periodicitat (15 min, hora, 6 h, dia o setmana) i l'hora de les diàries es
desen al singleton `crm_configuracio` i es canvien des de Configuració. Amb
`SINCRONITZACIO_AUTOMATICA=0` el rellotge no s'arrenca (útil en desenvolupament).

Abans de desplegar-ho cal executar, amb credencials d'administrador,
`scripts/crm-directus.mjs` (camps nous a `crm_clients`, les col·leccions
`crm_proveidors` i `crm_articles` i les col·leccions `crm_configuracio` i
`crm_sync_execucions`) i `scripts/crm-acces.mjs` (permisos del compte de
màquina sobre les col·leccions noves). El testimoni del portal no pot tocar
l'esquema: aquests dos scripts demanen `DIRECTUS_EMAIL` i `DIRECTUS_PASSWORD`.

### Detalls de la integració

Ja resolts a `apis/factusol/client.ts`:

- **Autenticació**: `POST /login/Autenticar` amb la contrasenya en Base64.
  Retorna un testimoni temporal que es desa en memòria i es renova quan caduca,
  quan l'API respon `Unauthorized` o quan canvien les credencials.
- **Consultes**: `POST /admin/LanzarConsulta` amb un `SELECT` i l'exercici
  fiscal. Només es demanen les columnes necessàries: `F_CLI` en té 200 i
  `F_PRO`, 104.
- **Format de resposta**: l'API retorna cada fila com un array de parells
  `{columna, dato}`, no com un objecte. `client.ts` ho aplana abans de
  retornar-ho.
- **Paginació**: l'API no en té, així que la retallada es fa al servidor
  després de portar el resultat.
- **Catàlegs**: `FPACLI`, `AGECLI` i `FAMART` són claus foranes. `apis/factusol/catalegs.ts`
  intenta resoldre-les contra `F_FPA`, `F_AGE` i `F_FAM`; aquests noms segueixen la
  convenció de FactuSol però no surten a la documentació pública, així que si
  no existeixen a la instal·lació es mostra el codi en cru.

Documentació oficial: <https://apidoc.sdelsol.com/>

## Desplegament

Publicat a Google Cloud Run:

| | |
| --- | --- |
| Projecte | `winebackend-portal` (vproof CRM) |
| Regió | `europe-west1` |
| Servei | `wine-backend` |
| URL | <https://wine-backend-140120684729.europe-west1.run.app> |

L'ID del projecte no és `winebackend` perquè aquest nom ja el tenia agafat un
altre projecte: els identificadors de GCP són únics a tot Google Cloud i no es
poden canviar després.

Per tornar a desplegar després d'un canvi, des de l'arrel del projecte:

```bash
./desplega.sh           # comprova el codi, pregunta i desplega
./desplega.sh --si      # sense preguntar
./desplega.sh --prova   # només comprova: no puja res
```

L'script comprova els tipus i el lint, que gcloud tingui la sessió oberta i
accés al servei, i llavors fa el mateix que (amb el compte
`david@healthivity.io`, que és el que té accés al projecte):

```bash
gcloud run deploy wine-backend --source . \
  --project=winebackend-portal --region=europe-west1
```

Puja la carpeta tal com és, també el que no s'ha desat a git, i marca el servei
amb l'etiqueta `commit`. Les variables del servei no es toquen. Si la
compilació falla, la versió que corria continua funcionant. Si gcloud diu que
la sessió ha caducat, cal `gcloud auth login david@healthivity.io` abans.

El `Dockerfile` fa una imatge en tres etapes amb la sortida `standalone` de
Next.

### Variables del servei

`AUTH_SECRET`, `DIRECTUS_URL`, `DIRECTUS_TOKEN` i, si es connecta l'ERP, les
`FACTUSOL_*`. Per consultar-les:

```bash
gcloud run services describe wine-backend \
  --project=winebackend-portal --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"
```

## Com a app al mòbil

El portal és instal·lable: a iOS, Compartir → «Afegeix a la pantalla d'inici»;
a Android, Chrome ofereix «Instal·la l'aplicació». S'obre a `/crm` sense la
barra del navegador. El manifest surt de `app/manifest.ts` i les icones es
dibuixen a partir del segell a `app/icon.tsx` i `app/apple-icon.tsx`: no hi ha
cap PNG al repositori. El middleware deixa passar aquestes rutes sense sessió,
perquè el sistema les demana sense galeta en instal·lar.

La sessió és llarga i lliscant perquè l'app no demani la contrasenya cada dia:
cada dia d'ús l'allarga fins a 30 dies, amb un sostre de 90 des de l'entrada.
A canvi, el middleware comprova un cop al dia contra Directus que el compte
segueixi actiu (amb el testimoni de màquina): suspendre un usuari a Directus
el fa fora del portal en menys d'un dia. Tot això és a `lib/sessio.ts` i
`middleware.ts`. No hi ha service worker: no cal per instal·lar-la i evita
servir dades velles d'un CRM.

## Notes

- Els mòduls operatius són **CRM**, **El meu compte** i **Configuració**. La
  resta d'entrades de menú estan desactivades (`actiu: false` a
  `lib/navegacio.ts`) i les seves pantalles mostren un estat explícit d'«en
  preparació».
- **El meu compte** (`/compte`) edita nom, cognoms, correu i contrasenya de
  qui ha entrat. Es desa a Directus en nom de la persona: el portal hi entra
  amb la seva contrasenya actual i toca només `/users/me`, així el compte de
  màquina no necessita permís d'escriure usuaris. Cal accés d'app al rol.
- `AUTH_SECRET` té un valor de desenvolupament per defecte: **defineix-lo**
  abans de desplegar o les sessions seran falsificables.
- Fotografies a `public/`: [vinya al capvespre](https://commons.wikimedia.org/wiki/File:Vineyard_during_sunset_(Unsplash).jpg)
  i [laboratori](https://commons.wikimedia.org/wiki/File:Wine_Cellar_Showing_Barrels(GN11869).jpg),
  totes dues en domini públic (CC0) via Wikimedia Commons.
- Els identificadors interns del codi són en català; els noms de columna de
  FactuSol (`CODCLI`, `NOFCLI`…) es mantenen tal com els defineix l'ERP.
