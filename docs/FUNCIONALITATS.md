# vproof CRM · Repassada de funcionalitats

CRM per a una distribuïdora de **producte sanitari veterinari**. Ve del portal
de gestió d'una distribuïdora de vi (`dreifs-uvic/bodega-portal`) i s'ha
adaptat al sector: els cellers ara són **laboratoris**, els vins són
**productes** i els tastos són **presentacions** de producte.

Cada funcionalitat porta el seu estat:

- ✅ funciona tal com està, sobre la base de dades SQLite del portal;
- 🟡 funciona amb les dades que porta l'ERP (vprooferp): sense connexió, la taula és buida;
- ⏳ pendent.

## 1. Accés i usuaris

| Funcionalitat | Estat | Notes |
| --- | --- | --- |
| Entrada amb correu i contrasenya | ✅ | Comptes a la taula `usuaris`, contrasenyes xifrades amb scrypt. El primer cop es crea l'administrador de `PORTAL_USUARI` / `PORTAL_CONTRASENYA`. |
| Sessió signada i lliscant | ✅ | Galeta signada amb `AUTH_SECRET`; cada dia es comprova que el compte segueixi actiu i es posa al dia el rol i l'agent. |
| Rols: Administrador, Manager, Comercial | ✅ | L'administrador gestiona usuaris; el manager veu els clients de tothom; el comercial només els del seu agent. |
| Pantalla **Usuaris** (només administrador) | ✅ | Crear, editar, suspendre, canviar el rol i lligar cada usuari a un agent comercial. Cada canvi demana la contrasenya de l'administrador. |
| **El meu compte** | ✅ | Nom, cognoms, correu i contrasenya (cal la contrasenya actual). |
| Abast per agent | ✅ | Qui no ho veu tot només llegeix, edita i esborra el que és dels clients del seu agent, i el que crea porta el seu agent. Es comprova al servidor. |

## 2. CRM

| Funcionalitat | Estat | Notes |
| --- | --- | --- |
| **Tauler** | ✅ | KPI (pipeline obert i ponderat, conversió, cicle de venda, leads nous, visites i presentacions, activitat, valor mitjà, velocitat del pipeline, tasques vençudes…), gràfics Highcharts i mapa de calor d'activitat per comercial i mes. |
| Tauler de negoci (facturació, rànquings de productes) | 🟡 | Les xifres surten de `crm_facturacio` i dels albarans: arribaran amb l'ERP. Els rànquings de productes presentats ja funcionen. |
| **Avui** | ✅ | Les visites i les tasques del dia, amb telèfon, contacte i horari del client. |
| **Agenda** (Planner) | ✅ | Calendari per mes o setmana, amb les activitats repartides per segment. |
| **To-Do** | ✅ | Tot el que queda per fer, d'on surt (l'activitat que el va deixar) i de qui és. |
| **Activitats** | ✅ | Trucades, visites, visites amb productes, visites de laboratori a client, visites de clients al laboratori, correus i reunions. Tipus configurables. Foto, durada, cost, resultat i proper pas. |
| Tancar una activitat | ✅ | En tancar-la se'n poden deixar To-Do i atributs del client. |
| Productes d'una activitat | ✅ | Es trien del catàleg (fins a un màxim per activitat) o des del configurador en modal. |
| **Fulla de productes en PDF** | ✅ | Des d'una activitat o des del selector: categoria, nom, principi actiu, foto, espècie, preu (opcional), forma, format i observacions. El comercial pot retocar preu, descompte i observacions abans de treure-la. |
| **Selector de productes** | ✅ | Configurador per criteris (categoria, principi actiu, espècie, forma farmacèutica, via, prescripció, format, laboratori, estoc, preu), cistella i plantilles desades. |
| Marques «Presentat» i «Comprat» al selector | ✅ / 🟡 | «Presentat» surt de les activitats; «Comprat» dels albarans, que portarà l'ERP. |
| Estoc i preu al selector | 🟡 | Es llegeixen de les columnes `estoc_actual`, `estoc_disponible` i `preu` de cada producte. Es poden posar a mà a la fitxa del producte fins que les ompli l'ERP. |
| Dia de visita al selector | ✅ | Tria un dia del calendari i hi posa d'un cop els clients d'aquell dia; la cistella es pot afegir a totes les visites del dia. |
| **Planificador** (segments) | ✅ | Segments de clients per criteris (població, comarca, categoria, potencial, tipus, regió dibuixada al mapa…). Rondes de visites des d'un segment. |
| **Mapa** | ✅ | Clients i establiments sobre OpenStreetMap (Leaflet), agrupats, filtrables per agent; dibuix de regions per als segments. Geocodificació automàtica cada quart d'hora. |
| **Oportunitats** | ✅ | Embut: contacte, qualificada, presentació, proposta, negociació, guanyada, perduda. |
| **Leads** | ✅ | Conversió a client: les activitats, els To-Do i els productes presentats passen al client. |
| **Clients** | ✅ | Llista amb filtres per columna, color segons quant fa que no es visita, periodicitat objectiu, categoria (per facturació) i potencial (a mà). |
| Fitxa del client | ✅ / 🟡 | Dades, activitats, productes presentats, contactes, establiments, leads convertits, To-Do, atributs i horaris (comercial i d'entregues). La pestanya Facturació (gràfic i albarans) espera l'ERP. |
| **Contactes** | ✅ | Persones de cada client o lead; botons per trucar, WhatsApp i correu. |

## 3. Catàleg

| Funcionalitat | Estat | Notes |
| --- | --- | --- |
| **Laboratoris** | ✅ | Llistat, fitxa amb els seus productes i les activitats on han sortit. Es creen i s'editen des del portal. |
| **Productes** | ✅ | Catàleg amb filtres per característiques i foto. Es creen i s'editen des del portal (amb preu i estoc). Els històrics (descatalogats) s'amaguen si no es demanen. |

## 4. Configuració

| Funcionalitat | Estat | Notes |
| --- | --- | --- |
| Valors CRM · categoria dels clients | ✅ | Franges de facturació de l'exercici passat per a la lletra A–E. |
| Valors CRM · tipus d'activitat | ✅ | Crear, reanomenar, activar o desactivar; si compten com a visita, si porten productes i si porten laboratori. |
| Tipus de client | ✅ | Clínica veterinària, hospital veterinari, botiga d'animals, explotació ramadera, distribuïdor i altres (editables). |
| Agents comercials | ✅ | Es creen al portal i es lliguen als usuaris. |
| Connexió amb l'ERP | ✅ | Estat, «Sincronitza ara» i historial de passades (vegeu més avall). |

## 5. Altres

| Funcionalitat | Estat | Notes |
| --- | --- | --- |
| App instal·lable (PWA) | ✅ | «Afegeix a la pantalla d'inici»; s'obre al CRM sense la barra del navegador. |
| Disseny adaptat al mòbil | ✅ | Cap pantalla rasca de costat; les taules passen a fitxes. |
| Mòduls d'ERP pendents (tauler comercial, vendes, comandes, albarans, factures, magatzem) | ⏳ | Tenen ruta però no pantalla; no surten al menú. |

## 6. Què s'ha tret

- **FactuSol**: client de l'API de DELSOL, sincronització de clients,
  proveïdors, articles, albarans i facturació, programador de passades, còpia
  de fotos, pantalles de l'ERP en directe i la pestanya de connexió.
- **Directus**: identitat, emmagatzematge i fitxers. Tot viu ara a SQLite
  (`dades/vproof-crm.sqlite`) i al disc (`dades/fitxers/`).
- Els scripts de migració de Directus, la documentació de la integració amb
  FactuSol, el full de càlcul de clients i el PDF de mostra de vins.
- Tot el vocabulari del vi: anyada, varietat, productor, zona, regió, colors
  del vi, ampolles, la marca anterior i les seves fonts.

## 7. Connexió amb vprooferp (ERPNext)

La sincronització va de l'ERP cap al CRM (`serveis/erp-sincro.ts`, client a
`apis/vprooferp/`). Es fa sola cada 30 minuts (`VPROOFERP_SINCRO_MINUTS`) i a mà
des de **Configuració › Connexió amb l'ERP**, on queda el resultat de cada passada.

| De l'ERP (doctype) | Al CRM |
| --- | --- |
| Customer Group | Tipus de client (adopta els del CRM amb el mateix nom) |
| Sales Person | Agents comercials |
| Supplier (amb l'adreça principal) | Laboratoris |
| Customer (adreça principal, comercial de l'equip de vendes) | Clients; inactiu a l'ERP = baixa |
| Address d'entrega lligades a un client | Establiments |
| Item, Item Price (llista de venda), Bin, Item Default/Supplier, foto | Productes: preu, estoc actual i disponible, laboratori, foto |
| Delivery Note i línies (aquest exercici i el passat) | Albarans, i la marca «Comprat» del selector |
| Sales Invoice (tres exercicis) | Facturació mensual, resum i categoria de cada client |

El que és només del CRM no es toca: potencial, periodicitat, horaris, notes,
activitats, les característiques veterinàries dels productes… Les fitxes de
l'ERP tenen bloquejats al formulari els camps que porta l'ERP. Les que l'ERP
deixa de portar queden marcades com a absents, no s'esborren.

**Credencials**: la clau d'API d'un usuari de l'ERP amb permís de lectura
(rols Sales User, Stock User, Purchase User i Accounts User). Es posa com a
secrets del repositori (`VPROOFERP_API_KEY` i `VPROOFERP_API_SECRET`) i el
desplegament la copia a la configuració del CRM a la VM. El CRM parla amb l'ERP
per la xarxa interna de Docker de la VM.
