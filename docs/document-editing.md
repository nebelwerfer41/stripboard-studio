# Creazione ed editing dei documenti Studio

## Analisi del progetto e lacune

L'applicazione è statica, senza database: MSD/MMSX vengono interpretati localmente e conservano l'archivio originale. Il contratto comune di `project-model.js` collega schede, elementi, calendari, piani/gruppi, eventi e Red Flags. I selettori di Calendar, Spoglio, DOOD e report leggono le stesse raccolte. I writer nativi precedenti modificavano esclusivamente scheduling e calendari; lo Studio v1 conservava metadati DOOD/stampa ed eventi aggiuntivi.

Sono stati letti README e i documenti interni su modello comune, calendari, MSD writer, MMSX e DOOD, insieme ai parser, writer, selettori, comandi e test esistenti. Le lacune pertinenti erano l'assenza di progetti vuoti, editor di scheda/elementi/produzione, quantità modificabili, gestione categorie, giornate e banner espliciti, Red Flags e modifica degli eventi importati. La sola attivazione di input non avrebbe reso persistenti queste modifiche: i writer proprietari non serializzano tali raccolte.

## Fonti ufficiali consultate il 12 ottobre 2026

- [Entertainment Partners — Movie Magic Scheduling](https://www.ep.com/movie-magic-scheduling/): descrive schede, elementi, board/sub-board, calendario con eventi anche fuori dal periodo riprese, verifica dei conflitti e DOOD alimentato dalle presenze. Descrive anche caratteristiche MMS10 che non vengono estese automaticamente ai file MMS6. Consultati i paragrafi dedicati; le funzionalità cloud, collaborazione, budget e personalizzazione dei layout sono fuori ambito.
- [EP — Academic Lesson Plan SAMPLE, MMS6](https://downloads.adc.ep.com/doc/MovieMagicSchedulingAcademicLessonPlan-SAMPLE.pdf): l'estratto disponibile spiega la scheda per scena, categorie/elementi e strip di riepilogo, INT/EXT × DAY/NIGHT, lunghezza in ottavi e riordino con fine giornata. La posizione della strip determina il momento di impiego delle risorse. L'indice cita Calendar Manager, Red Flag, Element Manager e report: **il testo di questi capitoli non è incluso**, quindi non ne vengono attribuiti comportamenti specifici. Non è stato consultato un manuale completo MMS6/MMS10 dietro autenticazione.
- [StudioBinder — Create a shooting schedule](https://support.studiobinder.com/en/articles/10723878-how-to-create-a-shooting-schedule): documenta creazione del piano, riordino delle scene, day breaks e tempi per organizzare riprese su più giornate.
- [StudioBinder — Assign a location to a scene](https://support.studiobinder.com/en/articles/1393585-how-to-assign-a-location-to-a-scene-in-breakdowns): documenta il collegamento della scena alla location di ripresa. Set narrativo e location fisica restano due campi distinti nel modello locale.
- [StudioBinder — Generate a DOOD report](https://support.studiobinder.com/en/articles/6706291-how-to-generate-a-dood-report): il DOOD è derivato dal piano e permette di organizzare la disponibilità degli interpreti.
- [StudioBinder — Edit a scene in breakdowns](https://support.studiobinder.com/en/articles/11072887-how-to-edit-a-scene-in-breakdowns): **accessibilità parziale**. La ricerca restituisce titolo e sintesi, ma l'apertura diretta restituisce soltanto campi input; non sono state ricostruite procedure o schermate mancanti. Consultato anche l'[indice Breakdown](https://support.studiobinder.com/en/collections/10571900-breakdown), come elenco dei flussi disponibili, non come documentazione dei dettagli non letti.

### Comportamenti documentati e decisioni locali

Le fonti documentano scene/schede, categorie/elementi, strip, ottavi, giorni e report derivati. Sono decisioni progettuali locali: conservare le identità durante le rinomine; distinguere quantità assente da zero; permettere numeri scena alfanumerici e duplicati (già presenti nelle fixture); conservare gli intervalli civili dei vincoli durante la ripianificazione; mantenere Boneyard condivisi MMSX; usare lo Studio v2 come documento completo. Derivano dal contratto interno e dai limiti degli adattatori, non da una presunta specifica proprietaria. Cast/personaggi continuano a essere elementi della categoria del file; attori, contatti e altri dati si salvano nelle proprietà, senza introdurre un secondo catalogo di persone.

## Funzioni e uso

Nel menu del titolo progetto è disponibile **Nuovo progetto**. L’editing è integrato nelle viste del documento:

- Produzione: titolo e tutte le proprietà, anche aggiuntive.
- Scene: numero scena, sheet in sola lettura, sinossi, INT/EXT, DAY/NIGHT, set, location, script day, unità, sequenza, pagine script, ottavi, entrambi i tempi, commenti. Collegamento/scollegamento degli elementi e quantità per scheda; quantità vuota significa `null`.
- Elementi: nome/categoria, Board ID, ordine, note, proprietà, collegamenti. Le rinomine aggiornano associazioni, riferimenti di eventi e vincoli, cataloghi e campi integrati corrispondenti.
- Categorie: nome, colore e metadati interpretati. La rinomina aggiorna i riferimenti nelle schede e nei campi dei layout, senza cambiarne la geometria, oltre alle regole DOOD.
- Calendari: creazione, nome, prep/start/end/wrap e opzioni; regole settimanali, eccezioni e ripianificazione restano nei controlli Calendar esistenti. Nessun cambio automatico delle giornate al solo cambio dei metadati.
- Piani: creazione vuota o copia del piano, descrizione, rinomina e calendario associato.
- Giornate: creazione e modifica di data/numero. Scene e banner si assegnano con drag o F2; l'ordine effettivo resta quello dei gruppi/strip.
- Banner: creazione, testo, tempo stimato e gruppo di destinazione.
- Red Flags: creazione/modifica di nome, tipo, ID tipo sorgente, colore, nota, intervallo e target. Il tipo `unavailable` alimenta anche i conflitti DOOD. Le date restano fisse durante la ripianificazione.
- Eventi: l'editor condiviso Calendar/DOOD modifica anche gli eventi importati; conserva metadati sconosciuti, target non risolti e tipi sconosciuti, evitando conversioni implicite.

Spoglio riserva tutta la riga a Set, Sinossi e Commenti; Location e Sequenza hanno più spazio dei campi numerici. Sinossi e Commenti crescono con il testo, fino a un’altezza massima scorrevole. Le stesse proporzioni sono usate per le nuove scene e si adattano ai pannelli stretti e al telefono. Lo sheet è un valore visualizzato, senza controllo di inserimento: i comandi rifiutano le modifiche al suo numero e le nuove scene ricevono automaticamente il numero successivo ai valori numerici già presenti. I numeri importati non vengono rinumerati.

Spoglio modifica i campi direttamente nella scheda, anche accanto alla Stripboard o a Calendar. Gli elementi si scelgono con checkbox e ricerca dentro ciascuna categoria; è possibile crearli nella stessa scheda. Le quantità mantengono la distinzione fra vuoto e zero. Elementi e progetto mostra categorie laterali, ricerca e campi Nome/Board ID modificabili nella tabella. Creazione e proprietà aggiuntive usano form nella vista corrente, senza aprire un editor globale. La Stripboard offre Scena, Banner, Fine giornata e Proprietà piano; selezionando un banner compaiono testo e colori. Visualizzazione contiene i colori INT/EXT × DAY/NIGHT; la scheda scena permette anche colori individuali. Calendar contiene la gestione di calendari, giornate, banner e piani nella propria barra. Annulla/Ripeti sono sempre nella barra superiore. Le modifiche complete usano transazioni con rollback e Undo/Redo; Ctrl/⌘-Z e Ctrl/⌘-Shift-Z funzionano in tutte le viste, fuori dagli input e dalle finestre modali. L'applicazione segnala bozze non applicate, sostituzione di documenti non salvati, errori di caricamento/scrittura e salvataggio in corso.

## Persistenza, migrazione e compatibilità

`studio-project.js` legge ancora Studio v1 e i file MSD/MMSX esistenti. Un edit completo passa a Studio v2 **al salvataggio**, senza riscrivere il file originale. Studio v2 contiene il modello condiviso autorevole e, per i progetti importati, i byte originali in base64. Piani/scene nuovi e modifiche ai dati sono nel documento, mentre l'archivio conserva sezioni, layout, campi e numeri proprietari sconosciuti. All'apertura il parser originale viene eseguito e il documento completo viene applicato; si riconnette il Boneyard condiviso dopo la decodifica JSON.

Il salvataggio fotografa il documento all'inizio dell'operazione. Una scrittura fallita o annullata non marca il documento come salvato. In assenza di picker, o quando il browser non ne consente l'uso, viene scaricato un file reale; l'applicazione può conoscere l'accettazione del download, non il completamento sul disco. I nomi Studio non accumulano suffissi alla riapertura.

**Limite esplicito:** l'editing completo si salva e si riapre in `.studio.json`; non viene offerta una conversione completa verso MSD/MMSX, perché manca una specifica verificata per scrivere tutte le sezioni proprietarie. I serializer nativi rifiutano questi documenti per impedire export incompleti. Per i documenti che hanno soltanto riordini/calendari restano operativi gli export conservativi preesistenti e il no-op binario. Le regole DOOD e gli eventi Studio v1 mantengono il precedente export nativo del solo piano. Non si dichiara interoperabilità del contenitore Studio con Movie Magic.

Le identità, i localizzatori sorgente, dati derivati e geometrie dei layout sono gestiti dai servizi: non sono campi da modificare a mano. I progetti vuoti usano il layout strip standard esistente e la stampa schedule/DOOD; non generano template di report proprietari. I report importati restano utilizzabili e ricevono i dati aggiornati.

## File interessati

- `assets/document-model.js`: creazione, comandi e validazione, sincronizzazione delle dipendenze, snapshot/rollback.
- `assets/integrated-editing.js`: campi diretti, categorie, ricerca, catalogo e transazioni.
- `assets/document-editor.js` e `assets/document-editor.css`: form contestuali, proprietà, riferimenti e bozze; solo Nuovo progetto resta modale.
- `assets/studio-project.js`: contenitore v2 e lettura v1.
- `assets/app.js` e `index.html`: collegamenti delle sezioni, cronologia, apertura e salvataggio reali.
- `assets/production-events.js`: editing degli eventi; `assets/production-data.js`: vincoli anche per i campi integrati.
- `assets/msd-parser.js`: conserva anche le relazioni `linkedElements` già interpretate; writer MSD e MMSX: protezione contro export completi non supportati.
- Test del modello, browser e aggiornamento del caso di versione Studio non supportata.

`assets/style.css`, `report-layout.js`, `strip-display.js`, i componenti di stampa e le funzioni di rendering report/stripboard non sono stati modificati.

## Verifiche riproducibili

```sh
node --test tests/*.mjs
node tests/document-editing.mjs
CHROME_PATH=/usr/bin/chromium node tests/browser-document-editing.cjs
CHROME_PATH=/usr/bin/chromium STUDIO_TEST_OUTPUT=/tmp/stripboard-qa node tests/browser-workspace.cjs
CHROME_PATH=/usr/bin/chromium STUDIO_TEST_OUTPUT=/tmp/stripboard-dood-qa node tests/browser-dood.cjs
git diff --check
```

Il test browser usa i controlli integrati, verifica l’assenza di finestre modali durante l’editing, filtri, quantità zero, creazione rapida, colori, rinomine e salvataggio/riapertura anche su telefono.

I test nuovi verificano campi/quantità/proprietà, identità e relazioni dopo le rinomine, vincoli, snapshot, documenti nuovi, calendari/piani, archivio originale MMSX 3/5/ibrido, Boneyard condiviso, formati/versioni non validi e assenza di export nativi silenziosamente incompleti. Il test browser confronta dimensioni, posizioni, font, bordi e padding dei campi report e delle strip prima/dopo l'editing di un MSD reale; copre download/riapertura, authoring da zero, errori di scrittura e aggiornamenti fra viste. Il contenuto può cambiare e continuano a valere le regole preesistenti di crescita/paginazione.

### Esito della verifica finale

- `node --test tests/*.mjs`: **20 file/suite passati**, nessun fallimento.
- `node tests/document-editing.mjs`: **10 casi passati**, compresi quantità opache/riferimenti non risolti e MMSX esistenti senza calendario.
- `browser-document-editing.cjs`: passato il ciclo MSD reale → editing → Studio → riapertura, confronto geometrie report/strip, progetto da zero con scheduling/vincoli/eventi/rinomine, errore di scrittura con modifiche conservate e retry, evento nativo MMSX modificato e riaperto con archivio originale conservato.
- `browser-workspace.cjs`: passati parser, categorie speciali, round-trip, conservazione, calendario, drag tra viste, Undo/Redo, salvataggio nativo senza modifiche e modifica/ripianificazione MSD.
- `browser-dood.cjs`: passati presenze integrate, regole/eventi, history, conservazione degli export preesistenti MSD/MMSX 5/3/ibrido, anteprima e PDF effettivo con parità di pagine/testo.
- Confronto testuale con HEAD: invariati `renderBoard`, `renderReport`, `makeStrip`, `makeSpecialStrip`, `createShapes`, `addLines`, `geometry`, `stripMetrics`, `reportBlock`, `fitReportBlocks`; invariati CSS principale e moduli di layout/stampa.
- `git diff --check`: nessun errore.

Le prove browser sono state eseguite con Chromium Linux su server statico locale. Safari/iPad, picker di sistema effettivo e riapertura degli export con un'installazione di Movie Magic non sono stati verificati in questa sessione. Nessun dato di produzione privato è stato aggiunto.

### Verifica v1.17

147 test Node passati e suite Chromium di authoring integrato, workspace, responsive e DOOD/PDF passate. Le verifiche includono proporzioni dei campi, espansione delle aree di testo, assenza di controlli per modificare lo sheet, protezione nel modello, numerazione automatica, preservazione dei valori importati, Undo/Redo e salvataggio/riapertura.
