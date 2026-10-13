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

## Funzioni e uso — v1.18

Nel menu del titolo progetto è disponibile **Nuovo progetto**. Spoglio modifica direttamente la scena attiva; gli affiancamenti si scelgono nella barra principale oltre 1200 CSS px. Set, Sinossi e Commenti occupano tutta la riga, Location e Sequenza hanno spazio maggiore dei codici numerici; le aree di testo crescono e si adattano al telefono.

- **Scene:** numero scena, sheet in sola lettura, sinossi, INT/EXT, D/N, set, location, script day, unità, sequenza, pagine script, pagine in ottavi, tempi e commenti. Le pagine si inseriscono come `2 3/8`, `3/8` o `2`; il modello conserva gli ottavi interi. Tempo stimato `HH:MM`, tempo schermo `MM:SS`. Sheet non modificabile; le nuove scene ricevono automaticamente il numero successivo ai valori numerici esistenti. I valori importati non vengono rinumerati.
- **Inserimento:** Scena crea una strip dopo quella selezionata e apre il suo Spoglio. Banner crea la strip nella stessa posizione e mostra testo, tempo e dimensione font nella barra del piano. Nessuna schermata di creazione separata.
- **Fine giornata:** introduce un confine dopo la strip selezionata, senza chiedere data/numero. Le giornate seguono in ordine il calendario del piano, saltando riposi ed eccezioni; la numerazione prosegue dal numero iniziale esistente. Se il punto coincide con un fine giornata esistente non crea un duplicato. Il Boneyard non ha giornate.
- **Elementi:** catalogo per categoria, ricerca, ordinamento per nome/ID, checkbox e selezione globale. Assegna ID numerici consecutivi con prefisso facoltativo agli elementi selezionati, spostali in un’altra categoria o salva l’ordine visualizzato. Conflitti di nome/ID impediscono l’operazione. Identità, quantità per scena, eventi e vincoli rimangono collegati. Nome/Board ID sono modificabili nella tabella; quantità vuota resta distinta da zero.
- **Colori strip:** finestra separata con matrice INT/EXT × D/N, colori sfondo/testo e preferenze per banner, fine giornata e selezione. Le combinazioni salvate si applicano alle scene con quei valori; il colore non si modifica dalla singola scheda. Senza modifiche esplicite, i colori nativi importati restano visibili. Indicatori selezione rettangolari rossi, larghi al massimo 4 pixel dello schermo, all’interno della strip; bordi rossi.
- **Visualizzazione:** overlay con layout/campi Stripboard e Calendar indipendenti, visibilità e stampa. Queste preferenze non modificano il file. I comandi di affiancamento sono nella barra principale.
- **Piani e calendari:** creazione, proprietà e riordino dentro i rispettivi selettori. Proprietà piano e altri form contestuali usano il sistema condiviso di overlay, chiudibile con ×, Escape o clic esterno. Nuovo piano può essere vuoto o copiare un piano esistente.
- **Calendario:** proprietà, prep/start/end/wrap, settimana lavorativa ed eccezioni condividono un solo overlay. Salva aggiorna i piani associati in una transazione; cambiare il selettore associa effettivamente quel calendario al piano. Non ci sono anteprime di ripianificazione o etichette di proiezione. Importare non ripianifica le date native. Il Boneyard è escluso dai sub-board calendario; eventuali definizioni sorgente dedicate al Boneyard restano conservate nell’archivio.
- **Calendar:** selezione multipla con checkbox o modificatori/long press, drag tra date e viste, doppio clic per aprire la strip selezionata in Stripboard. La barra contiene navigazione date, impostazioni, selezione ed eventi; le vecchie voci sovrapposte Vista/Strip sono riunite nell’overlay Visualizzazione.
- **Produzione, categorie, eventi e Red Flags:** restano modificabili tramite form contestuali condivisi; i riferimenti vengono aggiornati nelle altre viste. Eventi e intervalli civili dei vincoli rimangono alle date originarie durante la ripianificazione. Per ora non si possono aggiungere nuovi campi personalizzati; quelli importati sono conservati.

Annulla/Ripeti sono nella barra superiore. Le operazioni sui dati sono transazioni con validazione e rollback; Ctrl/⌘-Z e Ctrl/⌘-Shift-Z funzionano fuori dagli input e dagli overlay. La chiusura di un overlay annulla la sua bozza; i campi diretti applicano il valore al cambio del campo. Restano le protezioni per sostituzione di documenti non salvati ed errori di caricamento/scrittura.

## Persistenza, migrazione e compatibilità

`studio-project.js` legge ancora Studio v1 e i file MSD/MMSX esistenti. Un edit completo passa a Studio v2 **al salvataggio**, senza riscrivere il file originale. Studio v2 contiene il modello condiviso autorevole e, per i progetti importati, i byte originali in base64. Piani/scene nuovi e modifiche ai dati sono nel documento, mentre l'archivio conserva sezioni, layout, campi e numeri proprietari sconosciuti. All'apertura il parser originale viene eseguito e il documento completo viene applicato; si riconnette il Boneyard condiviso dopo la decodifica JSON.

Il salvataggio fotografa il documento all'inizio dell'operazione. Una scrittura fallita o annullata non marca il documento come salvato. In assenza di picker, o quando il browser non ne consente l'uso, viene scaricato un file reale; l'applicazione può conoscere l'accettazione del download, non il completamento sul disco. I nomi Studio non accumulano suffissi alla riapertura.

**Limite esplicito:** l'editing completo si salva e si riapre in `.studio.json`; non viene offerta una conversione completa verso MSD/MMSX, perché manca una specifica verificata per scrivere tutte le sezioni proprietarie. I serializer nativi rifiutano questi documenti per impedire export incompleti. Per i documenti che hanno soltanto riordini/calendari restano operativi gli export conservativi preesistenti e il no-op binario. Le regole DOOD e gli eventi Studio v1 mantengono il precedente export nativo del solo piano. Non si dichiara interoperabilità del contenitore Studio con Movie Magic.

Le identità, i localizzatori sorgente, dati derivati e geometrie dei layout sono gestiti dai servizi: non sono campi da modificare a mano. I progetti vuoti usano il layout strip standard esistente e la stampa schedule/DOOD; non generano template di report proprietari. I report importati restano utilizzabili e ricevono i dati aggiornati.

## Implementazione e verifiche

`document-model.js` conserva identità e relazioni; `workspace-commands.js` gestisce inserimenti, calendario e operazioni in massa. `entry-format.js` converte frazioni e tempi. `integrated-editing.js` riusa le viste Spoglio/catalogo; `overlay-service.js` fornisce il sistema comune a proprietà, calendari, colori, impostazioni, eventi e stampa. `calendar-editor.js`, `strip-colors.js` e `workspace-ui.css` contengono i relativi controlli e adattamenti responsive. Il contenitore Studio resta v2: v1.18 è la versione dell’applicazione.

```sh
node --test tests/*.mjs
CHROME_PATH=/usr/bin/chromium node tests/browser-workspace-revision.cjs
CHROME_PATH=/usr/bin/chromium node tests/browser-calendar-selection.cjs
CHROME_PATH=/usr/bin/chromium node tests/browser-calendar-rules.cjs
CHROME_PATH=/usr/bin/chromium node tests/browser-responsive.cjs
CHROME_PATH=/usr/bin/chromium node tests/browser-strip-layouts-drag.cjs
CHROME_PATH=/usr/bin/chromium node tests/browser-dood.cjs
git diff --check
```

155 test Node passati: formati, conservazione degli inserimenti, date e riposi/eccezioni, conflitti e relazioni degli elementi, MMSX 3/5/ibrido, snapshot, round-trip e protezione sheet. Le suite Chromium verificano il campione MSD reale, salvataggio/riapertura Studio con archivio originale identico, Undo/Redo, overlay e clic esterno, catalogo in massa, colori, font, selezione, calendario e sette dimensioni fra 320 e 1201 px. Passano anche calendario denso, drag mouse/touch fra viste, gli adattatori HTML nativi e DOOD/anteprima/PDF effettivo.

Le prove browser usano Chromium Linux su server statico locale. Safari/iPad, picker di sistema e riapertura degli export con Movie Magic non sono stati verificati in questa sessione. Nessun dato di produzione privato è stato aggiunto.
