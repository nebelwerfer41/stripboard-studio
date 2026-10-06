> **Supporto MMSX:** importazione ed esportazione locale dei piani dataFormat 5, oltre al supporto MSD. Funzioni, limiti e test in [docs/mmsx-support.md](docs/mmsx-support.md).

# Stripboard Studio v1.4

Il supporto ai **Production Calendars** e alle **Red Flags** del file MSD è descritto in [docs/msd-production-calendars-red-flags.md](docs/msd-production-calendars-red-flags.md). Le viste Calendari e Red Flag Entry permettono di consultare questi dati senza modificare il file.

L'audit del formato per l'editor e la strategia conservativa di scrittura sono in [docs/msd-writer-audit.md](docs/msd-writer-audit.md).

App statica per visualizzare e riordinare stripboard, creare piani alternativi e consultare i modelli di report contenuti nei file Movie Magic Scheduling 6 (`.msd`). Parser, renderer e writer funzionano nel browser: nessun backend, database o account richiesto. I file importati restano nel browser e non vengono caricati su un server.

## GitHub Pages

Carica il contenuto di questa cartella nella radice di un repository GitHub. Nelle impostazioni del repository, apri **Pages**, scegli **Deploy from a branch**, quindi `main` e `/ (root)`. L'app sarà disponibile all'indirizzo Pages del repository. I percorsi HTML, CSS, JavaScript e dei campioni sono relativi, quindi funzionano anche con l'URL di un repository (`/nome-repository/`).

Il solo file di esempio incluso è `samples/Wonderful Life Demo.msd`; verrà pubblicato insieme al sito. Puoi comunque usare **Importa .msd** per aprire un file locale. GitHub Pages serve i file statici; l'importazione e il parsing avvengono nel browser.

## Avvio locale

Su macOS, fai doppio clic su `Avvia Stripboard Studio.command`. Se macOS blocca il primo avvio, apri Terminale nella cartella dell'app ed esegui:

```sh
python3 -m http.server 0 --bind 127.0.0.1
```

Apri l'indirizzo con la porta indicata dal comando. Il launcher sceglie automaticamente una porta libera e apre il browser. Python serve solo i file statici durante la prova locale: non legge né interpreta gli MSD. Puoi usare qualsiasi altro server HTTP statico. L'apertura diretta di `index.html` con `file://` non è supportata dai browser per moduli JavaScript e caricamento dei campioni.

Il browser deve supportare `DecompressionStream('deflate-raw')`, `DOMParser`, `XMLSerializer` e i moduli JavaScript. Parser e writer accettano la variante EPSF/MSD 6 osservata nei campioni.

## Funzioni

- Selezione di progetto, piano di lavorazione e layout di stripboard salvato nel `.msd`.
- Clic o tap su una scena per selezionarla e renderla attiva. Ctrl/⌘-clic aggiunge o rimuove elementi; su touch, tieni premuta una strip per entrare nella multiselezione, poi usa i tap per aggiungere o rimuovere. Esc o un clic nello spazio vuoto azzerano la selezione. La strip si trascina direttamente; su touch il drag inizia dopo una pressione lunga e un movimento intenzionale. Se la strip era già selezionata, si sposta l’intero gruppo mantenendo l’ordine relativo. La preview mostra numero di scene e ottavi totali, più gli altri elementi, e una linea indica l’inserimento. Banner e fine giornata si trascinano allo stesso modo.
- **Annulla** (o Ctrl/⌘-Z) ripristina l’ordine prima dell’ultima operazione; **Ripeti** (o Ctrl/⌘-Maiusc-Z) applica di nuovo il riordino annullato. Da tastiera, Invio o Spazio selezionano una strip e F2 apre la scelta di giornata e posizione. La posizione «Alla fine» di un `ScheduleDay` è prima del day break generato dal layout.
- **＋** accanto al piano crea una nuova stripboard copiando l'ordine corrente. Il nuovo piano usa gli stessi riferimenti alle scene e può essere modificato indipendentemente; il nome univoco è l'identità prevista dal formato osservato. Il selettore cambia il piano corrente e il valore `ActiveStripBoard` esportato.
- **Salva .msd** produce un nuovo file `-edited.msd`. Il testo «Modifiche non salvate» segue le revisioni del documento; se il salvataggio fallisce, le modifiche restano disponibili. Se il browser non offre un selettore di salvataggio con esito confermato, viene avviato un download e lo stato diventa salvato quando il browser accetta il download.
- Selettore del calendario accanto al layout: mostra lo stesso piano con le date inferite dal calendario scelto, senza cambiare il riferimento `CalendarName` nel file.
- Vista **Calendari** con elenco dei calendari MSD, giorni non lavorativi, date di produzione, eccezioni e griglia mensile con le giornate di ripresa del piano.
- Vista **Red Flag Entry** con filtri per categoria, elemento, tipo e intervallo di date, griglia mensile, elenco e dettaglio delle segnalazioni. I tipi provengono dal `RedFlagMgr`; la gestione e la modifica restano future.
- Visualizzazione di scene, banner, giorni, date e coda non programmata, con ricerca e controlli per nascondere banner e fine giornata.
- Banner e fine giornata disegnati come strip a larghezza uguale alle scene.
- Interruttore **Colori strip**: applica la griglia colori `INT/EXT` × `Giorno/Notte` del file, oltre ai colori dedicati di banner e fine giornata; può tornare alla vista neutra.
- Giorni senza testata aggiunta e senza spazio finale; nei layout verticali, giorni affiancati con scorrimento orizzontale.
- Anteprima orizzontale della stripboard adattata automaticamente alla larghezza del pannello, anche quando la finestra viene ridimensionata.
- Anteprima dei layout report contenuti nel file, con campi collegati ai dati e stampa dal browser. Banner e fine giornata, quando previsti dal modello, compaiono come righe di testo nel flusso del report.
- Stampa della stripboard con formato carta, orientamento, margini e scala gestiti dalla finestra di stampa del browser; nell'app restano le opzioni per header e nuova pagina dopo ogni giornata.
- Importazione locale di altri file `.msd` compatibili con il formato dei campioni.

Le date dei giorni sono derivate dai calendari come nel parser incluso e vengono indicate come stimate. Cambiare calendario è una proiezione di lettura: conserva strip, scene e ordine del piano. L'anteprima dei report riproduce contenuti e geometria dei campi principali; funzioni di impaginazione e formule proprietarie di Movie Magic non sono replicate completamente.

## Writer MSD e integrità

Un salvataggio senza modifiche restituisce i byte originali. Dopo un edit, il writer ricostruisce soltanto la sezione XML `StripBoardMgr` usando i nodi originali delle strip, poi aggiorna offset e lunghezza nella section map EPSF. Le altre dodici sezioni del campione sono copiate byte per byte, inclusi Calendars, Red Flags, breakdown, template, report, layout, metadata e proprietà non interpretate. La sezione modificata usa blocchi DEFLATE raw non compressi: il file salvato può essere più grande, ma il contenuto delle altre sezioni resta identico. Il writer rifiuta un edit se una strip originale sarebbe persa o duplicata.

Nel campione l'ordine delle strip è l'ordine dei figli di `ScheduleDay`, `RemainingScheduledStrips` e `RemainingUnscheduledStrips`/`UnscheduledDay`. I day break sono generati dal layout e non hanno un record proprio; spostarli ripartisce le strip tra i gruppi `ScheduleDay`, preservandone attributi e identità. L'ordine dei piani e `SortOrder` sono distinti: nel campione differiscono e Movie Magic Scheduling 6.02.413 ha mostrato nel menu l'ordine fisico dei piani. Nessun ID numerico di piano, checksum o riferimento diretto da Red Flags ai piani è presente nei campioni. Il writer non attribuisce nuovi ID alle scene o ai piani.

`tests/roundtrip.html` verifica identità binaria senza edit, riapertura dopo movimenti e nuovo piano, conteggi/riferimenti e conservazione delle sezioni opache. `tests/strip-drag.mjs` copre il riordino di gruppo, l’attraversamento dei giorni e la preview. Il file modificato di prova è stato aperto in Movie Magic Scheduling 6.02.413: l'app ha mostrato il nuovo piano e le strip spostate tra le giornate. All'apertura ha selezionato il primo piano nonostante `ActiveStripBoard` puntasse al nuovo; il comportamento di questa preferenza resta da chiarire. Compatibilità con versioni MSD diverse, file con checksum/estensioni di contenitore e salvataggio successivo da Movie Magic non sono ancora verificati.

## Fedeltà dei layout MSD

Il modello compatto espone dimensioni della strip (`StripLength`, `StripWidth`), geometria dei campi e delle linee, stili testuali, `PageFormat/Paper` con `PrintableRect`, layout del day break e dell'header, oltre agli attributi originali di layout e banner. Nei campi Element Sum, `Type=0/1` mostra il totale, `Type=2` solo il testo e `Type=3` testo e totale; `Suppress` nasconde il campo quando il totale è zero. Il totale usa il numero iniziale del nome di ciascun elemento, se presente, altrimenti conta l'elemento come uno. Nei report, `PrntCat=1` dei campi Custom List mostra il nome della categoria prima degli elementi.

Nei report, `BDSCategoryElementsField` con `Style=GRID` dispone gli elementi su righe, mentre `Style=COMMA_DELIMETED_LIST` li separa con virgole. Il valore `COMMA_DELIMETED_LIST` è stato verificato nel layout «Report di Esempio» del file MSD fornito. `NumColumns` e `ColCnt` impostano il numero di colonne degli elenchi a griglia; `WrapText` controlla il ritorno a capo dentro ciascuna voce. Le tabelle di elementi della stripboard usano gli ID e i filtri `LowBoardIDFilter`/`HighBoardIDFilter`. `CategorySource=ALL_REMAINING` esclude le categorie già indicate dagli altri campi del report. `SeparateRecordsWithALine` controlla la linea tra i record e `KeepOnOnePage` evita che un record venga spezzato nella stampa. `IsGrowable`, `Flow`, `RowHeight` e `SplitColumnAfterRows` sono conservati dal parser ma richiedono ancora una verifica del comportamento originale prima di guidare l'impaginazione.

Per gli stili di banner e day break, `Alignment` usa i valori `20` (sinistra), `21` (destra) e `22` (centro). La stampa elimina l'arrotondamento e il ritaglio del pannello dell'app, così i bordi delle strip restano squadrati.

Nei file di esempio non esiste un attributo di margine/spaziatura del day break o di interruzione pagina della stripboard. Il day break occupa quindi una strip della stessa altezza prevista dal layout, senza margine esterno; il piccolo padding del testo è interno. L'opzione «Nuova pagina dopo ogni giorno» è interna all'app e parte disattivata. `HideStripBoardHeader` del piano determina lo stato iniziale dell'opzione header. Per i report, `ReportSettings.PageBreak` è una proprietà distinta e non viene applicata alla stripboard.

Il browser gestisce la carta e l'area stampabile senza un vincolo `@page` imposto dall'app. La stripboard viene ingrandita o ridotta automaticamente per occupare la larghezza stampabile quando l'altezza delle strip lo consente; la scala resta regolabile nella finestra di stampa. Il file `.msd` conserva i suoi valori originali. `PrintScale` e `ScaleStyle` rimangono nel modello originale: nei template osservati `ScaleStyle=Refit`, mentre alcuni valori `PrintScale` non sono coerenti con la lunghezza della strip.

La barretta laterale è stata rimossa dalla stripboard. La larghezza del canvas di stampa dipende solo dalle strip; l'header opzionale e il bordo sinistro delle strip partono dallo stesso margine stampabile. Nei report, `IncludeBanners`, `IncludeDayBreaks` e `DayBreakFooterText` del template determinano le righe speciali di partenza; i controlli di visibilità possono nasconderle senza modificare il modello MSD.

Restano da riprodurre con precisione alcuni dettagli proprietari: pattern e codici dei bordi dei singoli campi, stili `AREA`, formule dei tempi stimati nei banner/day break, immagini nei layout e l'esatta semantica di tutti i valori numerici di `Type` nei conteggi categoria. Gli attributi originali necessari sono mantenuti nel modello dove disponibili. Non è stato possibile confrontare visivamente questi campioni con un'installazione di Movie Magic Scheduling.

## Verifica

Apri `tests/parser.html` dal sito statico per confrontare il parser JavaScript con i valori attesi di Wonderful Life. I file Python originali sono in `legacy/` come riferimento storico; l'app non li usa.

Crediti: [nebelwerfer41 su GitHub](https://github.com/nebelwerfer41).
