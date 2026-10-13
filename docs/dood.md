> **v1.19:** l’editor Elementi espone le regole DOOD nella propria scheda, con la stessa configurazione del report. Le nuove Red Flags con tipo riconosciuto Unavailable/Travel/Fitting/Rehearsal alimentano gli eventi DOOD; i valori proprietari non riconosciuti restano conservati. L’anteprima di stampa aggiunge scala automatica/manuale per il piano. Vedi [editing corrente](document-editing.md).

> **Editing completo:** le successive funzioni di creazione/modifica e il contenitore Studio v2 sono descritti in [document-editing.md](document-editing.md). Le limitazioni delle fasi precedenti riportate sotto sono storiche.

# Day Out of Days — analisi e contratto

Dalla v1.13 il DOOD mostra una sola categoria alla volta: all’apertura seleziona la prima categoria disponibile e il menu non offre «Tutte». Matrice, regole categoria/elemento, CSV Summary e stampa seguono la categoria scelta. Cambiare categoria è una preferenza di visualizzazione e non modifica il progetto.

## Categorie integrate — v1.14

Set, Location, Script Day, Unit, Sequence, DN e INT/EXT contribuiscono alle presenze tramite i campi della scena, oltre ai riferimenti agli elementi dello spoglio. MMSX conserva gli ID nativi di questi campi in `scene.fieldElementIds`: elementi omonimi con ID diversi restano distinti. MSD risolve i valori scalari per campo/categoria e nome; riusa gli ID del catalogo e proietta righe con ID stabili quando manca una voce, come DN e INT/EXT nel campione incluso. `doodElements` è una proiezione di sola lettura: raccolte, conteggi e file importati restano invariati. Le regole per elementi derivati rimangono metadati Studio.

`tests/dood-builtins.mjs` verifica tutti i campi, identità native, elementi omonimi, categorie personalizzate distinte, trasferimenti nel Boneyard, salvataggio/riapertura e Undo nei formati MMSX 5/3/ibrido. La suite browser DOOD confronta le date di lavoro delle sette categorie integrate con i campi delle scene effettivamente programmate del campione MSD.

## Fase 1: architettura verificata prima dell'implementazione

- `project-model.js` normalizza scene (`bdsId`, `id`), elementi (`id`, categoria, BoardID) e `scene.elementRefs`. MSD associa categoria/nome; MMSX conserva ID e quantità. Il motore usa gli ID risolti, non il testo visualizzato.
- `board-segments.js` raggruppa board/sub-board senza copiarle. In MMSX ogni piano modificabile rappresenta un segmento normale; il Boneyard è condiviso. In MSD ogni piano ha un segmento normale locale.
- Le giornate sono gruppi `ScheduleDay` di `scheduledGroups`. Il day break è il confine del gruppo, non una scena. `RemainingScheduledStrips`, gruppi senza data e Boneyard non costituiscono presenze datate. Date e shooting day sono distinti; più gruppi possono avere la stessa data civile.
- `scheduling.js` sposta strip e confini e ripartisce i gruppi. `calendar-commands.js` crea giornate su date civili e ripianifica esplicitamente. Il DOOD deve ricalcolare dai gruppi correnti, senza usare `calendar.dates[].shootingDays`, che può rappresentare l'importazione.
- `production-data.js` risolve pattern settimanali/eccezioni e segnala calendario ambiguo con `working=null`. MSD inferisce date e preserva date bloccate tramite estensione calendario già esistente; MMSX importa date native. Il DOOD usa la data del gruppo e il calendario associato alla sub-board, senza cambiare il piano.
- `project.events` contiene già eventi di calendario MMSX con intervalli, scope e target multipli. Le Red Flags sono distinte; il significato numerico di `DOODStatus` MSD non è verificato. Non sarà interpretato come evento DOOD.
- `app.js` mantiene history comune e revisioni; gli adapter salvano conservativamente MSD/MMSX. Le preferenze UI sono nello stato della sessione. Nuove impostazioni non native devono vivere nel progetto Studio.
- La stampa esistente consiste in `window.print()` e CSS `@media print`: nessun servizio interno per carta/margini, nessuna anteprima paginata o libreria PDF. Il servizio condiviso introdotto userà i renderer correnti dello schedule e un renderer tabellare DOOD; PDF tramite la destinazione Salva come PDF del browser.
- MSD importa categorie, elementi, associazioni, calendario e layout/report con attributi raw. Non ci sono regole Hold/Drop o eventi individuali con semantica verificata. Le sezioni opache restano conservate. Nessun nuovo dato DOOD sarà scritto in campi proprietari MSD.

## Strategia di persistenza

Il contenitore `.studio.json` conserva il piano serializzato nel suo formato originale e i metadati Studio (regole per sub-board, eventi aggiunti e impostazioni di stampa). L'importazione riusa gli adapter originali. L'esportazione nativa rimane disponibile; non include metadati Studio. Nessuna matrice o presenza viene salvata.

## Fasi 2–5: implementazione

- `dood-engine.js`: motore puro, stati strutturati, riferimenti a scene/strip/eventi, contributi giornalieri booleani, totali separati, ordinamento stabile fino a quattro criteri. Ogni render legge i gruppi correnti; non mantiene cache di presenze.
- `dood-view.js`: unica vista operativa, intestazioni e quattro colonne fisse, settimana/data/weekday/shooting day, filtri e navigazione temporale. Il dettaglio apre le scene nella stripboard. Le preferenze di visualizzazione sono di sessione; le regole per categoria e override parziali per elemento sono nel progetto Studio e nella history comune.
- `production-events.js`: unico editor di `project.events`, accessibile da Calendar e DOOD. Target multipli e intervalli inclusivi; Travel/Fitting/Rehearsal/Unavailable individuali e Holiday/Move aziendali. Eventi aggiunti sono modificabili/eliminabili con undo/redo. Eventi nativi sono consultabili e conservati inalterati. Red Flags esplicitamente tipizzate `unavailable` sono proiettate come indisponibilità senza duplicare record; i valori MSD numerici non sono interpretati.
- `print-layout.js`, `print-service.js`: geometria carta/margini/orientamento/scala condivisa con lo schedule, dialogo di anteprima e stampa browser/PDF. Il renderer schedule riusa le strip esistenti, la geometria sorgente anche su telefono, i colori e l'opzione header. Il renderer DOOD usa esattamente la matrice filtrata/ordinata della vista e pagine tabellari in due dimensioni. Densità e scala sono indipendenti; il font non scende sotto 6 pt alla scala 1. Non si cerca di adattare tutto a una singola pagina. Anteprima e stampa usano lo stesso documento nell'iframe.
- `dood-print.js`: date/weekday/shooting day, totali, nomi e ID, titolo/progetto/versione/data locale e pagine numerate. Ripetizione opzionale delle intestazioni e colonne identificative. Summary in testa, in coda o da solo; Worked/Held/Travel/Fitting/Rehearsal e prima/ultima scena. CSV UTF-8 apribile in Excel dalla stessa matrice.
- `studio-project.js`: contenitore Studio versionato con piano nativo serializzato, metadati e soli eventi aggiunti. Il pulsante Salva usa Studio quando il progetto contiene metadati nuovi; il DOOD offre anche l'esportazione originale MSD/MMSX, che non marca salvati i metadati Studio. La riapertura ricostruisce i riferimenti degli eventi alle sub-board mediante il nome stabile della board. Nessuna dipendenza aggiunta.

## Interpretazioni di Studio (non comportamenti MMS verificati)

1. Hold predefinito attivo, Drop predefinito disattivo, minimo 7 giorni. Override parziali ereditano dalla categoria; Hold disattivo rende Drop inefficace.
2. Prima/ultima scena sono le prime/ultime **date civili**, indipendentemente dalla sequenza fisica delle strip. Più gruppi sulla stessa data hanno una sola cella e possono elencare più shooting day. Strip prive di giornata datata sono escluse con una nota.
3. Il minimo Drop conta le date civili interamente libere **fra** rilascio e rientro, escludendo le due date limite e includendo weekend/festività. Attività individuali TR/FT/R dividono gli intervalli; possono fungere da data di rilascio/rientro solo entro il periodo delle scene. Unavailable non è prestazione e non impedisce Drop. Nessun periodo Drop contribuisce a Worked/Held.
4. Rilascio/rientro su attività senza scene sono `D TR`, `P FT`, ecc. Un rientro che è anche rilascio fra due gap mostra `PW D` (o `P D` su evento): entrambe le condizioni rimangono esplicite nello stato. Nessuna ipotesi su codici proprietari non documentati.
5. Holiday/Move sono visibili come eventi aziendali anche fuori dal contratto; contribuiscono soltanto con Hold attivo e fra prima/ultima scena, **limiti inclusi**, fuori Drop. Non sono Held. Una scena effettivamente schedulata resta Worked anche in giorno off o con indisponibilità; quest'ultima produce un conflitto. Calendario ambiguo non genera Hold.
6. Attività simultanee mostrano più token nella stessa cella. Worked è l'unione delle prestazioni giornaliere, non la loro somma; i contatori individuali sono distinti. Eventi sconosciuti o intervalli invalidi sono diagnosticati e non interpretati dal nome.
7. La paginazione usa misure fisiche e una stima conservativa dell'ingombro del testo. Righe lunghe sono aumentate, mai tagliate; una singola riga che eccede la pagina produce un messaggio e disabilita la stampa. La scala manuale resta una scelta dell'utente.

## Verifiche e limiti espliciti

Eseguire `node --test tests/*.mjs`; per i singoli casi, `node tests/dood-engine.mjs` e `node tests/dood-print.mjs`. Con server locale e Playwright/Chromium già disponibili:

```sh
CHROME_PATH=/usr/bin/chromium node tests/browser-dood.cjs
CHROME_PATH=/usr/bin/chromium STUDIO_TEST_OUTPUT=/tmp/stripboard-qa node tests/browser-workspace.cjs
```

La suite DOOD verifica selezione iniziale e cambio di categoria senza opzione «Tutte», fallback da selezioni non valide senza modificare il documento, il campione MSD reale (59 cast), regole/override, navigazione scena, eventi, undo/redo, conservazione binaria dell'esportazione nativa, salvataggio/riapertura Studio, contenitori MMSX 5/3/hybrid, anteprima condivisa, Summary-only, ingombro tabelle e PDF effettivo con numero di pagine/testo corrispondente all'anteprima. I test puri coprono scene uniche/multiple, Hold/off, Drop/soglie, eventi prima/dopo le scene e fra gli intervalli, Holiday/Move, spostamenti strip/day break, calendario, sub-board e paginazione su entrambi gli assi.

Rinvii: generazione PDF diretta senza dialogo browser e file XLSX nativi (disponibili Salva come PDF e CSV); editing di eventi nativi e decodifica dei valori DOOD proprietari MSD; importazione di regole/report DOOD senza campioni che ne dimostrino la semantica. Nessun confronto di conformità con un'installazione MMS 6/10 è stato eseguito. Nel dialogo browser usare scala 100%, margini nessuno e disabilitare intestazioni/piè di pagina del browser; carta e impaginazione sono già nel documento dell'anteprima.
