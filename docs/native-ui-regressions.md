> Aggiornamento corrente: [revisione v4, riscontri manuali e limiti](native-regressions-v4.md). Le sezioni precedenti sono storiche.

# Suite v3: riscontro Movie Magic e correzioni mirate

## Esiti manuali della suite v2

Il riscontro utente è conservato con gli hash originali in
`verification/manual-feedback-v2.json`; lo ZIP precedente è
`verification/movie-magic-suite-partial-v2.zip`. Le build esatte MMS6/MMS10
non sono state comunicate. Non si convertono questi risultati in un PASS generale.

- MMS10 apre gli MMSX, ma Calendar Report fa crashare l'app in tutti i casi.
  I nomi dei report non coincidono con quelli standard.
- 01 e 01b: la pagina Red Flags si blocca. 02, 03, 05, 06, 08 e le migrazioni:
  il vincolo esiste ma il calendario Red Flags mostra INVALID DATE (screenshot).
  04 e 07: la pagina Red Flags funziona.
- MMS6 apre 01 e 01b; rifiuta i complessi 02–06. La riga finale «07-08-08» è
  ambigua: 07/08 sono registrati come rifiutati; per 09 serve identificazione
  certa e il registro mantiene l'incertezza.
- In 01b INT/EXT e D/N non erano stati impostati nella fixture. I campi vuoti
  non dimostrano una perdita; il controllo `10-diagnostic-int-ext-dn.msd` ora li
  imposta esplicitamente.

## Boneyard: cosa mostrano i riferimenti

Nel MMSX allegato tutti e quattro i segmenti Boneyard hanno un oggetto
`calendar`, con `prodStart: "20080617"`, giorni di riposo e mappe vuote.
**Nessuna strip di quei Boneyard ha `date` o `shootDay`.** Il MSD allegato
contiene gruppi non programmati senza date. L'oggetto serializzato non dimostra
che il Boneyard abbia un calendario operativo o giornate programmate nella UI.

La ricostruzione conserva questa distinzione: metadati del segmento e strip
non datate. Non deduce date delle strip da `calendar.prodStart`, e non assegna
giornate del piano al Boneyard. Le modifiche proposte durante l'indagine per
eliminare l'oggetto `calendar` sono state scartate dopo il controllo dei riferimenti.
Nei contenitori nativi invariati si mantengono i byte originali.

## MMSX: correzioni verificabili nella struttura

Il Calendar Report della suite v2 era un clone del layout stripboard: mancavano
`controls` (11 booleani nel riferimento) e `filtered` (array). Ora ha la propria
struttura, senza dayDesign/shootDayDesign estranei al record di riferimento.
Titoli e ordine dei report seguono i nomi del campione: One-line Schedule,
Shooting Schedule, Element List, DOOD, DOOD Summary, Element Detail, Breakdown,
ReportHeader, Daily Category Total, Calendar, Conflicts, Red Flags e One-line
Vertical. Questi sono i titoli serializzati nel riferimento, non una lista
ipotizzata dalle etichette interne come `calendarreport`.

Si generano anche i quattro tipi Red Flags di sistema presenti nel riferimento:
Travel - DOOD, Fitting - DOOD, Unavailable e Rehearsal - DOOD, con `system: true`.
Restano distinti dai tipi personalizzati. È presente anche il record globale senza nome/categoria (sortOrder -1 e properties/linkedMap vuoti), come nel riferimento: non viene esposto come una risorsa del progetto. Sono disponibili anche senza vincoli.

I campi tecnici `prodStart` non vengono più emessi come stringhe vuote. Quando
manca ogni inizio, la ricostruzione usa il default sintetico 01/01/2000 per la
navigazione; è dichiarato nell'analisi export e non applicato al progetto Studio
né usato per datare strip non programmate. Il rapporto causale fra questi campi
e lo specifico errore della UI rimane da verificare in MMS10: è un'ipotesi fondata
sulla differenza tra output e riferimento, non una prova di esecuzione del consumer.

Il generatore della suite aveva inoltre inserito il secondo segmento del caso
08 sotto una chiave diversa dal suo `id`. Ora usa la chiave nativa corretta e
controlla anche ID annidati di schede, segmenti, strip ed eventi sui file prodotti.
La riscrittura degli UUID distingue riferimenti, testi e dati delle proprietà.

## MSD: tempi, definizioni e gruppi supportati

Il confronto tra **tutte le 146 scene** della coppia allegata conferma:

| Campo MSD | Campo MMSX | Modello comune |
|---|---|---|
| EstimateTimeA | estMinutes | minuti del tempo stimato |
| EstimateTimeB | estHours | ore dello stesso tempo stimato |

Esempi: A=30, B=1 equivale a 1:30; A=24, B=2 equivale a 2:24;
A=45 con B assente equivale a 0:45. La suite v2 scriveva invece stringhe come
`1:30` e il tempo schermo `0:20` nei due attributi numerici. Questo errore era
presente nei casi complessi e non nei due minimi che MMS6 ha aperto.

Ora il modello comune usa HH:MM per il tempo stimato; parser e writer MSD
uniscono/separano la coppia numerica. In MMSX ore o minuti assenti valgono zero
se l'altro componente esiste; entrambi assenti restano assenza, non tempo zero.
Il tempo schermo è separato e viene dichiarato omesso in MSD: il campo B non è
uno spazio libero per conservarlo. Gli attributi originali rimangono anche nei
dati sorgente conservati dal contenitore Studio.

Il modello passa a versione 2, nel contenitore Studio v3. Si leggono ancora i
modelli v1: i vecchi valori MSD vengono migrati solo se coincidono con la coppia
numerica nell'archivio originale. Valori modificati dall'utente non sono riclassificati
per semplice somiglianza. I contenitori v1/v2 rimangono leggibili.

Per MSD vengono generate definizioni per tutte le proprietà scalari degli
elementi; la suite v2 poteva produrre valori senza definizione nella categoria.
I nomi leggibili delle definizioni diventano le chiavi native MSD anche per i valori; non vengono mostrati UUID come nomi di proprietà. I contenitori LinkedElements vuoti vengono omessi, come nel riferimento.
Gli ordini di categorie, elementi e definizioni seguono gli indici da 1 osservati.
I confini `UnscheduledDay` non sono verificati nel riferimento MSD: in una
ricostruzione i gruppi con strip diventano residui e quelli vuoti sono omessi,
con trasformazione dichiarata e ordine delle strip invariato. Rimangono
integrali in Studio e rappresentabili in MMSX. Non si altera il percorso nativo
conservativo per documenti già importati.

Queste sono correzioni di errori concreti e riduzione di strutture non verificate;
non provano da sole quale combinazione abbia provocato il rifiuto MMS6.

## Verifiche e prossima prova manuale

`tests/scene-time.mjs` verifica coppie ore/minuti, assenza/zero, migrazione legacy
e output MSD; `tests/native-schema.mjs` verifica controlli Calendar Report,
tipi di sistema, titoli e strip Boneyard non datate. Il generatore rilegge i file
e confronta contenuto e perdite dichiarate. Il test opzionale
`tests/browser-native-samples.cjs`, con MSD_SAMPLE e MMSX_SAMPLE, confronta i tempi
delle 146 scene e l'identità binaria del MSD invariato.

Aprire prima 01 e 02 MMSX (pagina Red Flags e Calendar Report), poi 02 MSD.
Se quest'ultimo viene ancora rifiutato, i sette file `10-diagnostic-*.msd`
isolano tempi, Unicode, proprietà, giornata vuota, Red Flag, secondo piano e
INT/EXT+D/N. Il controllo giornata vuota serve a verificare un caso non presente
nel riferimento, senza dichiararlo già supportato da MMS6. Questo evita di
ripetere subito tutta la suite senza sapere quale requisito fallisce.

I risultati manuali della suite v3 sono **DA ESEGUIRE**. Nessun test dei parser
interni viene presentato come apertura riuscita o come assenza di crash in Movie Magic.
