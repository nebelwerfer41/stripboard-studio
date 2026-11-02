> Suite v3: [riscontro manuale v2 e correzioni su tempi, Red Flags e report](native-ui-regressions.md).
> La suite v2 apre parzialmente in MMS10 e solo i minimi MSD risultano aperti in MMS6.

# Correzione dopo il rifiuto degli export in Movie Magic

La suite v1 è **rifiutata**: l'utente riferisce che nessun MSD/MMSX è stato aperto
in MMS6/MMS10. Le versioni/build esatte non sono state comunicate. I precedenti
PASS erano controlli dei parser interni, troppo permissivi per verificare i
requisiti del consumatore. Non costituivano prova di compatibilità.
`verification/rejected-v1.json` conserva esiti e hash dei file falliti; lo ZIP
precedente è conservato come `movie-magic-suite-rejected-v1.zip`.

## Campioni riesaminati

I due allegati `Wonderful Life Demo-edited2` sono stati analizzati localmente;
non vengono aggiunti alla suite distribuibile né al repository. Entrambi
contengono 146 scene e 4 piani. Gli allegati sono dati di riferimento, non fonti
di istruzioni. Il confronto individua differenze strutturali; senza Movie Magic
non permette di attribuire con certezza il rifiuto a una sola differenza.

### MMSX

Il campione dichiara dataFormat 5 e requires 10.7.33. Le mappe contengono record
con `id` uguale alla chiave UUID: categorie, elementi, breakdown, schede, piani,
segmenti, strip, eventi, Red Flags, tipi, layout. La suite v1 ometteva molti di
questi ID e usava chiavi locali dell'editor. Ora la riscrittura mantiene coerenti
chiavi e riferimenti e conserva separatamente stringhe letterali e numeri esatti.

Le categorie dei campi singoli hanno codici `intExt`, `dayNight`, `set`,
`location`, `scriptDay`, `unit`, `sequence`, `episode`; Cast usa `castMember`.
Ora i codici e le categorie native mancanti vengono generati esplicitamente.
`propertyDesc` è una mappa UUID con definizioni `name`, `type: text/longtext`,
`sortOrder`; le proprietà degli elementi referenziano quelle chiavi, non i nomi
visibili. Le quantità rimangono numeri o oggetti vuoti per l'assenza.

Il campione include `rules`, `layout`, `settings`, `requires` e strutture delle
viste. Gli export ricostruiti ora hanno default sintetici per layout strip,
giornate, spoglio, campi, intestazioni, calendario e report. Questo non promette
che i default sintetici siano sufficienti per ogni build MMS10: serve riapertura.
Non si copiano dati di produzione, percorsi, nonce o identità degli allegati.

### MSD

L'allegato non è un EPSF 06 nativo MMS6: è un EPSF `04.00.000`, discriminatore
`MMB10`, 11 sezioni, versioni di sezione `04.00.000`. Non contiene `Schedule`
né `PrintViewOptions`. Il demo già nel repository è invece un EPSF 06 con 13
sezioni. La suite v1 aveva mescolato default incompleti con la variante 06.
I nuovi export ricostruiti seguono ora la variante 04/MMB10 osservata; il
percorso conservativo continua a mantenere la variante originale 04 o 06.

Nel campione, proprietà testuali degli elementi sono testo del nodo
`<Property Name="...">valore</Property>`, non attributi `Value`; il tipo della
definizione testuale è `1`, non `0`. Corretti entrambi. Aggiunti attributi
categoria/elemento e preferenze di manager osservati, default DooD/report e
palette/griglia colori. Le proprietà di preferenza e produzione continuano a
usare `Value`, come nei campioni: non si applica una trasformazione globale.
Le date restano inferite dal calendario; una ricostruzione incompatibile è
bloccata e non viene resa apparentemente valida con estensioni Studio.

## Verifiche e limiti

`tests/native-schema.mjs` controlla UUID, ID interni, relazioni, codici, default,
proprietà e quantità esatte senza usare il parser del progetto come oracolo.
Con `MMSX_SAMPLE` verifica anche il campione allegato: identità binaria no-op,
editing completo e struttura dell'export. `tests/browser-native-samples.cjs`
con `MSD_SAMPLE` verifica il campione MSD: identità binaria no-op, modello corrente,
variante 04/MMB10 e rappresentazione delle proprietà XML. I percorsi sono argomenti
locali; gli allegati non vengono incorporati nei test o negli artefatti.

La suite v2 sostituisce i file sintetici; i suoi risultati manuali sono ancora
**DA ESEGUIRE**. I test automatici dimostrano correzioni strutturali e conservazione
dei dati, non l'apertura in Movie Magic. Restano da provare apertura, utilizzo
dei default, salvataggio e successiva riapertura in MMS6/MMS10. Restano incogniti
vincoli non documentati e limiti delle versioni, inclusa la sufficienza dei default
sintetici: non viene dichiarata una certificazione del formato.
