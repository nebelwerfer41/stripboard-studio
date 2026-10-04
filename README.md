# Stripboard Studio v1.3.0

App statica per visualizzare stripboard e modelli di report contenuti nei file Movie Magic Scheduling 6 (`.msd`). Il parser e il renderer sono JavaScript nel browser: nessun backend, database o account richiesto. I file importati restano nel browser e non vengono caricati su un server.

## GitHub Pages

Carica il contenuto di questa cartella nella radice di un repository GitHub. Nelle impostazioni del repository, apri **Pages**, scegli **Deploy from a branch**, quindi `main` e `/ (root)`. L'app sarà disponibile all'indirizzo Pages del repository. I percorsi HTML, CSS, JavaScript e dei campioni sono relativi, quindi funzionano anche con l'URL di un repository (`/nome-repository/`).

Il solo file di esempio incluso è `samples/Wonderful Life Demo.msd`; verrà pubblicato insieme al sito. Puoi comunque usare **Importa .msd** per aprire un file locale. GitHub Pages serve i file statici; l'importazione e il parsing avvengono nel browser.

## Avvio locale

Su macOS, fai doppio clic su `Avvia Stripboard Studio.command`. Se macOS blocca il primo avvio, apri Terminale nella cartella dell'app ed esegui:

```sh
python3 -m http.server 0 --bind 127.0.0.1
```

Apri l'indirizzo con la porta indicata dal comando. Il launcher sceglie automaticamente una porta libera e apre il browser. Python serve solo i file statici durante la prova locale: non legge né interpreta gli MSD. Puoi usare qualsiasi altro server HTTP statico. L'apertura diretta di `index.html` con `file://` non è supportata dai browser per moduli JavaScript e caricamento dei campioni.

Il browser deve supportare `DecompressionStream('deflate-raw')`, `DOMParser` e i moduli JavaScript. Il parser accetta la variante EPSF/MSD 6 osservata nei campioni; non scrive file MSD.

## Funzioni

- Selezione di progetto, piano di lavorazione e layout di stripboard salvato nel `.msd`.
- Visualizzazione di scene, banner, giorni, date e coda non programmata, con ricerca e controlli per nascondere banner e fine giornata.
- Banner e fine giornata disegnati come strip a larghezza uguale alle scene.
- Interruttore **Colori strip**: applica la griglia colori `INT/EXT` × `Giorno/Notte` del file, oltre ai colori dedicati di banner e fine giornata; può tornare alla vista neutra.
- Giorni senza testata aggiunta e senza spazio finale; nei layout verticali, giorni affiancati con scorrimento orizzontale.
- Anteprima dei layout report contenuti nel file, con campi collegati ai dati e stampa dal browser. Banner e fine giornata, quando previsti dal modello, compaiono come righe di testo nel flusso del report.
- Stampa della stripboard adattata al formato carta e all'area stampabile del layout, con opzioni indipendenti per header e nuova pagina dopo ogni giornata.
- Importazione locale di altri file `.msd` compatibili con il formato dei campioni.

Le date dei giorni sono derivate dai calendari come nel parser incluso e vengono indicate come stimate. L'anteprima dei report riproduce contenuti e geometria dei campi principali; funzioni di impaginazione e formule proprietarie di Movie Magic non sono replicate completamente.

## Fedeltà dei layout MSD

Il modello compatto espone dimensioni della strip (`StripLength`, `StripWidth`), geometria dei campi e delle linee, stili testuali, `PageFormat/Paper` con `PrintableRect`, layout del day break e dell'header, oltre agli attributi originali di layout e banner. Il renderer usa `Text` e `Suppress` dei campi di conteggio categoria: `Type=1` mostra il numero, mentre i tipi con label mostrano il testo salvato nel template prima del numero. Se `Type=2` non contiene `Text`, viene usato `CategoryName`.

Per gli stili di banner e day break, `Alignment` usa i valori `20` (sinistra), `21` (destra) e `22` (centro). La stampa elimina l'arrotondamento e il ritaglio del pannello dell'app, così i bordi delle strip restano squadrati.

Nei file di esempio non esiste un attributo di margine/spaziatura del day break o di interruzione pagina della stripboard. Il day break occupa quindi una strip della stessa altezza prevista dal layout, senza margine esterno; il piccolo padding del testo è interno. L'opzione «Nuova pagina dopo ogni giorno» è interna all'app e parte disattivata. `HideStripBoardHeader` del piano determina lo stato iniziale dell'opzione header. Per i report, `ReportSettings.PageBreak` è una proprietà distinta e non viene applicata alla stripboard.

La stampa usa l'orientamento e l'area stampabile del layout; lo zoom viene calcolato dalle dimensioni effettive del canvas e dalla pagina. `PrintScale` e `ScaleStyle` rimangono nel modello originale: nei template osservati `ScaleStyle=Refit`, mentre alcuni valori `PrintScale` non sono coerenti con la lunghezza della strip, perciò il fattore finale viene ricalcolato per evitare il taglio laterale.

La barretta laterale è stata rimossa dalla stripboard. La larghezza del canvas di stampa dipende solo dalle strip; l'header opzionale e il bordo sinistro delle strip partono dallo stesso margine stampabile. Nei report, `IncludeBanners`, `IncludeDayBreaks` e `DayBreakFooterText` del template determinano le righe speciali di partenza; i controlli di visibilità possono nasconderle senza modificare il modello MSD.

Restano da riprodurre con precisione alcuni dettagli proprietari: pattern e codici dei bordi dei singoli campi, stili `AREA`, formule dei tempi stimati nei banner/day break, immagini nei layout e l'esatta semantica di tutti i valori numerici di `Type` nei conteggi categoria. Gli attributi originali necessari sono mantenuti nel modello dove disponibili. Non è stato possibile confrontare visivamente questi campioni con un'installazione di Movie Magic Scheduling.

## Verifica

Apri `tests/parser.html` dal sito statico per confrontare il parser JavaScript con i valori attesi di Wonderful Life. I file Python originali sono in `legacy/` come riferimento storico; l'app non li usa.

Crediti: [nebelwerfer41 su GitHub](https://github.com/nebelwerfer41).
