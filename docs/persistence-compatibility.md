> Revisione corrente: [v6 — quantità selezionabili, totali e ID](quantities-and-export-v6.md). Le sezioni precedenti contengono risultati storici.

> Revisione corrente: [v5 — quantità, piani completi e quattro Red Flags native](native-regressions-v5.md). I riscontri precedenti restano storici.

> Revisione corrente: [riscontri v3 e correzioni candidate v4](native-regressions-v4.md). Colori MSD/MMSX, Day/Night, eventi e unicità delle scene hanno controlli dedicati. NO RED FLAGS e report richiedono ancora prova MMS10.

> Suite v3: [riscontro manuale v2 e correzioni su tempi, Red Flags e report](native-ui-regressions.md).
> La suite v2 apre parzialmente in MMS10 e solo i minimi MSD risultano aperti in MMS6.

> Aggiornamento: la suite v1 non si apre in Movie Magic (riscontro utente).
> Vedi [riesame dei campioni e correzioni](native-format-corrections.md).
> I PASS dei parser riportati nelle sezioni storiche non provano compatibilità nativa.

# Matrice di compatibilità e persistenza

Audit iniziale (prima dell'implementazione), 1 novembre 2026. Evidenze:
`project-model.js`, `document-model.js`, `studio-project.js`, `msd-parser.js`,
`msd-writer.js`, `mmsx-project.js`, `mmsx-production.js`, fixture sintetiche
`tests/fixtures/{mmsx,calendar}.mjs`, `msd-writer-audit.md`, `mmsx-support.md`.
Il sample Wonderful Life serve solo all'audit locale: non è la base degli output distribuiti.

| Dato | Studio | MSD EPSF 04.00.000 / MMB10 (nuovi export) | MMSX dataFormat 5 |
|---|---|---|---|
| Modello corrente, ID e relazioni | integrali | BDSID numerici, elementi per categoria/nome | ID e riferimenti a mappe |
| Sorgente opaco e numeri esatti | archivio originale integrale | byte identici nel percorso nativo invariato; ricostruzione senza opachi | idem |
| Scene, campi singoli, categorie, elementi | integrali | XML verificato nel parser | mappe verificate nel parser |
| Quantità | minimo attivo 1; zero/assenza storici conservati nei metadati | da 2 in su: numero iniziale o Nome (quantità), selezionabile; singoli senza decorazione | numeriche per scena, Use in daily qty per categoria; default/vecchio zero → 1 |
| Piani e segmenti | integrali, Boneyard condiviso | segmenti separati in piani completi; complemento del catalogo aggiunto al Boneyard | segmenti normali e Boneyard condiviso |
| Giorni e date | integrali | numerazione sequenziale; date inferite dal calendario, nessuna promessa su estensioni Studio in MMS6 | date e numeri espliciti |
| Calendari | integrali | giorni di riposo, eccezioni e date schedule | un calendario per segmento; nomi rigenerati dal parser |
| Eventi | integrali | Travel/Fitting/Rehearsal/Unavailable con elementi → Red Flags; altri omessi con notifica | eventMap con target elementi; destinatari globali non verificati omessi esplicitamente |
| Red Flags | integrali | quattro definizioni riservate sempre presenti; intervalli espansi, codici DOOD supportati | intervalli e target per ID |
| Layout, regole Studio, proprietà opache | integrali | conservati nel percorso nativo; ricostruzione limitata con dichiarazione | idem |
| Colori strip/palette | integrali | griglia e 32 slot RGB; override per scena omessi esplicitamente | regole e colori per scena; RGB fuori palette verificata approssimati con conferma |
| Varianti pregresse | migrazioni v1/v2 | lettura 04 MMB10 e 06; nuova emissione 04/MMB10 osservata nel nuovo allegato | nativo conserva 3, 3 ibrido o 5; nuova emissione solo 5 |

**Verificato** significa struttura letta/scritta e controllabile coi parser del
repository. Non significa certificazione del formato proprietario. Non esiste
uno schema ufficiale completo nel repository. L'audit precedente documenta una
singola apertura MSD modificata in MMS 6.02.413; non prova i file ricostruiti.
Restano **incognite** i requisiti aggiuntivi MMS6 per nuovi contenitori, le
versioni MMS10 compatibili con dataFormat 5, i default non documentati e il
salvataggio/riapertura nei programmi originali. La suite manuale deve registrare
separatamente questi risultati, senza dedurli dal round-trip automatico.

## Decisioni di implementazione

Studio v3 salva sempre il modello corrente e, separatamente, l'archivio sorgente
originale. Provenienza, formato del contenitore Studio e destinazione export
non sono intercambiabili. I writer conservativi restano disponibili per i
percorsi nativi verificati; l'adattatore comune ricostruisce quando necessario,
con analisi preventiva sul progetto concreto, conferma delle perdite e blocco
dei riferimenti o delle date non rappresentabili. Nessun export marca il
progetto come salvato. La suite sintetica e il suo manifest sono riproducibili.


## Contratto implementato

- `format` rimane l'indicatore dell'adattatore sorgente per compatibilità con il
  codice esistente; `provenance` è esplicita, `storageFormat: studio` identifica
  il contenitore riaperto e la destinazione è un argomento dell'export.
- Studio v3 salva `document.value`, percorsi numerici esatti in
  `document.exactNumbers` e `native` originale separato. Non invoca i writer
  nativi per salvare. Migra v1 (archivio + overlay Studio) e v2 (snapshot +
  archivio); la migrazione v2 conserva la riparazione preesistente dei parametri
  singoli contraddittori. I documenti v3 nuovi richiedono il modello validato.
- Il modello ha un ID progetto stabile; scene/elementi/calendari mantengono gli
  ID Studio. Le categorie mancanti nel catalogo sono esplicite e derivate,
  senza trasformare riferimenti irrisolti in riferimenti risolti.
- `analyzeExport` determina percorso nativo o ricostruito e restituisce elementi
  con codice, quantità e dettaglio in `kept`, `transformed`, `omitted`,
  `blockers`. Sia i writer sia il dialogo richiedono `acceptLoss` quando ci sono
  trasformazioni/omissioni. Gli impedimenti non sono aggirabili con la conferma.
- La firma del modello intercetta editing completo e modifiche dirette a scene,
  produzione, eventi, banner e opzioni non gestite dal writer conservativo.
  L'archivio originale non sostituisce mai queste modifiche. I movimenti e le
  regole calendario già supportati mantengono il percorso conservativo.
- I nuovi MSD usano BDSID numerici e mappe EPSF 04/MMB10 ricostruite con 11 manager,
  versioni e nomi sezioni osservati, un layout strip sintetico minimo e default
  calendario. Non copiano sezioni del demo. Le date dei giorni devono essere
  esattamente riproducibili dal calendario MSD; i numeri sono consecutivi.
  Red Flags su intervallo sono espanse inclusivamente (limite 3660 date).
- Le estensioni di data Studio dei MSD nativi sono conservate ma segnalate come
  trasformazione da confermare: non è verificato che MMS6 le legga. Gli export
  MSD ricostruiti non dipendono da queste estensioni.
- I nuovi MMSX usano mappe dataFormat 5; conservano famiglie di segmenti,
  Boneyard condiviso e quantità positive numeriche; assenza e vecchio zero → 1 sono trasformazioni dichiarate,
  eventi per calendario e intervalli Red Flags. Nomi calendario e numeri sheet
  non sono promessi come identità native. I manager/opachi non ricostruiti sono
  dichiarati, mentre restano integralmente nell'archivio del file Studio.

## Verifica e prove esterne

`node tests/persistence.mjs` verifica migrazioni, precisione, assenza/zero,
blocco degli export, modifiche senza flag di editing e archivio invariato.
`node tests/browser-persistence.cjs` verifica dialogo, conferma, download del
contenuto corrente e revisioni; esegue anche le quattro suite MSD HTML.
`tests/browser-document-editing.cjs` verifica authoring e riapertura Studio v3.
`tests/generate-manual-suite.cjs` produce e rilegge i file sintetici: confronta
le perdite dichiarate con i dati reimportati, non soltanto la possibilità di
parsing. Vedi `verification/movie-magic/manifest.json`, checklist e CSV.

La riapertura MMS6/MMS10 dei file nuovi non è stata eseguita in questo ambiente.
I manager opzionali vuoti e i default del layout sintetico sono candidati di
interoperabilità, non requisiti certificati: eventuali rifiuti o riparazioni
Movie Magic vanno registrati, quindi usati per estendere fixture e adattatore.
