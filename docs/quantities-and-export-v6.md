# Quantità e persistenza: revisione v6

## Evidenze e rettifiche

Il campione `qty.mmsx` conserva nomi senza decorazioni e quantità numeriche per
associazione: la stessa risorsa ha 15 e 34 in due scene, un'altra 22 e 12.
Il flag nativo della categoria è `useInDailyQTY`. Cast lo disattiva e non espone
il controllo quantità. Il riferimento è usato solo nei test locali, non distribuito.

L'utente ha corretto la sintassi MMS6: è valido `3 Nome` oppure `Nome (3)`,
**non** `(3) Nome`. Nessuna decorazione deve essere aggiunta per zero, uno o
assenza: sono singoli. La sintassi iniziale delle revisioni v4/v5 era errata;
gli ZIP e i relativi riscontri restano storici, senza essere rigenerati in silenzio.

Il riscontro sul caso 14 v5 è stato corretto dall'utente: gli eventi di sistema
sono trasferiti correttamente in MMS6. Le quattro definizioni standard del caso
15 sono intenzionali e rimangono sempre presenti. Il caso 16 richiedeva Board
ID unici anche sulle varianti: ora non vengono lasciati vuoti.

## Modello comune e interfaccia

Il modello passa a **versione 3**, nel contenitore Studio v3. Sono leggibili i
modelli 1/2 e i contenitori Studio v1/v2. `quantitySettings` è parte dello snapshot,
quindi partecipa a Salva, riapertura e Annulla/Ripeti. Il formato di provenienza,
il contenitore Studio e la destinazione export restano distinti.

- Ogni nuova associazione è singola, con quantità predefinita 1. L'editor non
  accetta numeri inferiori a 1. Gli zeri storici diventano attivamente 1, con il
  valore originale in `legacyQuantity` e nell'archivio sorgente preservato.
  L'assenza resta riconoscibile dalla provenienza del valore.
- Il sistema **MMS10 · per scena** usa il campo numerico dell'associazione.
  Le categorie possono esporre il controllo tramite “Usa nella quantità
  giornaliera”. Cast non mostra input quantità né il relativo checkbox.
- Il sistema **MMS6 · dal nome** legge un numero iniziale oppure un suffisso
  numerico tra parentesi; un valore zero/uno equivale a un singolo. Il nome resta
  nel documento originale e il valore per scena non viene sovrascritto passando
  da un sistema all'altro. I campi singoli (Set, I/E, D/N ecc.) restano separati
  dalle risorse con quantità.
- Come confermato dall'utente, il totale giornaliero prende il **massimo per
  identità dell'elemento** tra le scene del giorno: 15 e 34 diventano 34, non 49.
  Risorse diverse mantengono contributi distinti. Le esclusioni per associazione
  rimangono dati Studio; quando non rappresentabili sono dichiarate nell'export.
- I dati numerici esatti importati e gli archivi opachi restano conservati.
  Modificare un'altra associazione non converte un numero esatto in un float.

Nel breakdown la scelta del sistema è visibile accanto agli strumenti delle
categorie. Per numeri maggiori di uno il sistema per scena mostra anche la
quantità dopo il nome. Il formato di lettura predefinito è per scena per MMSX e
progetti nuovi, dal nome per MSD. I conteggi derivano dalla stessa funzione usata
dalle proiezioni, evitando somme di oggetti o stringhe.

## Export selezionabile e conferma

Il dialogo offre “Come nel progetto”, “MMS10 · quantità per scena” e “MMS6 ·
quantità dal nome”. Per MSD offre inoltre “Nome (quantità)” oppure “quantità Nome”.
Cambiare selezione ricalcola il rapporto e azzera la conferma delle perdite. Le
scelte di export non cambiano il progetto né la sua revisione di salvataggio.

### MSD

Le quantità da due in su vengono incorporate nei nomi secondo lo stile scelto;
uno e i vecchi zeri diventano semplicemente `Nome`. Le varianti mantengono le
proprietà e ricevono riferimenti delle scene, collegamenti e target Red Flag
coerenti. Ogni variante riceve un Board ID libero. Un conflitto con un nome
letterale già presente blocca l'export, senza rinominare in silenzio.

I nomi numerici esistenti vengono normalizzati alla convenzione scelta, evitando
una doppia quantità nel nome. Si tratta di una trasformazione notificata: il
numero resta testo nel formato MSD, non un campo quantità nativo. I nomi
storici con parentesi iniziali non sono sintassi MMS6 valida; l'originale Studio
con le quantità esplicite consente di riesportarli correttamente.

Ogni stripboard mantiene tutte le scene: quelle assenti dal segmento vengono
aggiunte al Boneyard, senza date. Le quattro definizioni Travel - DOOD, Fitting -
DOOD, Unavailable e Rehearsal - DOOD restano sempre presenti. Gli eventi di sistema
con elementi diventano Red Flags per data e destinatario, come nella v5 verificata
dall'utente. Portata globale, omissioni e trasformazioni restano notificate.

### MMSX

Le quantità sono valori numerici per scena, mai oggetti vuoti. Un vecchio zero
viene esportato come singolo, con notifica, anziché produrre la selezione invisibile
osservata nelle prove precedenti. Cast resta singolo senza un controllo quantità
nativo; valori Cast storici maggiori di uno restano conservati in Studio e sono
rappresentabili nei nomi MSD, ma la trasformazione a 1 in MMSX è dichiarata.

Il flag `useInDailyQTY` è ricostruito dalla categoria corrente, anziché essere
azzerato dal writer. Le preferenze modificate sono quindi effettive, non sostituite
in export da quelle dell'archivio originale.

Quando si sceglie il sistema dal nome, varianti come `Folla` e `Folla (3)` possono
tornare una sola risorsa MMSX con quantità 1 e 3 nelle rispettive scene. L'unione
è notificata: ID e Board ID originali restano nel contenitore Studio; target Red
Flags ed eventi vengono aggiornati. Proprietà incompatibili o presenza simultanea
delle due varianti nella stessa scena bloccano l'unione perché ambigua. La quantità
nei nomi di risorse inutilizzate, prive di un'associazione dove registrarla, è
segnalata come non rappresentata nel nuovo record elemento MMSX.

## Identità e Board ID

Gli ID interni dei record sono distinti dai Board ID mostrati all'utente.
L'export controlla l'unicità dei primi tra i record del grafo; tutte le nuove
identità sono generate con UUID e i riferimenti riscritti insieme.

I **Board ID non vuoti sono unici all'interno della categoria**, come nei formati
nativi: Cast 1 e Props 1 non sono lo stesso identificatore. Nuovi elementi e
varianti ricevono un numero libero. Assegnazioni e spostamenti di categoria che
creerebbero duplicati vengono rifiutati. Un progetto importato con duplicati può
essere conservato in Studio per correggerlo; il rapporto blocca l'export e indica
categoria ed elementi coinvolti. I nativi validi invariati mantengono i propri
byte e possono conservare Board ID non assegnati previsti dal formato.

## Verifiche e suite manuale

`tests/quantities.mjs` verifica modalità, minimo uno, massimo giornaliero,
migrazioni, riapertura Studio, ricomposizione delle varianti, collisioni e ID.
Con `QTY_SAMPLE` verifica il file allegato: byte identici se invariato e quantità/
flag delle categorie conservati dopo modifica completa e passaggio Studio.

`tests/browser-quantities.cjs` verifica i controlli Cast, il minimo 1, il cambio
modalità, la scelta dei due stili MSD, download e conversione MSD→MMSX. Sul
campione verifica anche il massimo giornaliero delle comparse: 34 + 22 + 1 = 57.
Le suite già presenti continuano a verificare persistenza, calendari, colori,
relazioni e produzione, separatamente dall'apertura in Movie Magic.

La suite v6 mantiene i casi precedenti aggiornandone le aspettative. Il caso 16
usa una categoria con quantità attive e Board ID distinti; il 17 verifica il
sistema dal nome e il 18 il numero iniziale MSD. I file rimangono sintetici e
riproducibili. La checklist e il CSV distinguono le prove nuove da quelle v5:
**i nuovi file devono ancora essere aperti, salvati e riaperti in MMS6/MMS10**.
