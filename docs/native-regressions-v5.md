> Revisione corrente: [v6 — quantità selezionabili, totali e ID](quantities-and-export-v6.md). Le sezioni precedenti contengono risultati storici.

# Revisione v5: quantità, completezza dei piani MSD e Red Flags di sistema

## Evidenze native e riscontro manuale

La suite v4 e i suoi hash rimangono nello ZIP versionato. Il riscontro successivo
è registrato in `verification/manual-feedback-v4.json`, senza trasformare
«il resto mi pare che funzioni tutto» in un PASS di ogni report o della riapertura.
Le build esatte delle applicazioni restano da registrare.

Nel riferimento MMSX locale le 840 associazioni risorsa hanno quantità numeriche
positive. La scrittura di `{}` per l'assenza era una nostra convenzione, accettata
dal nostro parser ma non verificata in MMS10. Lo screenshot del totale
`000[object…]` e la selezione invisibile degli zeri dimostrano che il round-trip
interno non bastava a verificarne l'uso nel consumer.

Per MSD sono stati confrontati tre riferimenti, senza distribuirne i contenuti:

| Evidenza | Travel | Fitting | Rehearsal | Unavailable |
|---|---|---|---|---|
| MSD del repository, target elemento | 16384 | 4096 | nessuna entry | 0 |
| Coppia MSD/MMSX fornita in precedenza | 0 | 0 | sola definizione | 0 |
| `redflags.msd` appena fornito, target generali | 0 | 0 | 0 | 0 |

I numeri sono `DOODStatus`, non quantità o codici testuali. Nel nuovo file tutte
le entry hanno `Category=""` ed `Element=""`; manca quindi un'entry Rehearsal
con destinatario elemento. L'utente ha confermato che assegnare Rehearsal a un
elemento in MMS6 produce **R** nel DOOD. Questa è una conferma della funzione
nativa, distinta dalla prova del nuovo export automatico.

Le quattro definizioni sono presenti nei riferimenti con `SortOrder="-1"`:
Travel - DOOD, Fitting - DOOD, Unavailable, Rehearsal - DOOD. Il manager e la
lista delle entry hanno anche le impostazioni di ordinamento riprese nella
nuova emissione. La v4 ometteva le definizioni non utilizzate e scriveva zero
in tutte le entry, impedendo di promettere le sigle native.

## Regole di esportazione implementate

**Quantità MMSX.** Le risorse senza quantità diventano associazioni numeriche con
valore predefinito **1**. Le associazioni a **zero** sono omesse dalla scheda
esportata: non diventano uno. L'elemento rimane nel catalogo, disponibile ma non
selezionato per quella scena. Entrambe le trasformazioni sono notificate, con
conteggi e nomi per gli zeri; Studio conserva assenza e zero distintamente.
I vecchi file sintetici con `{}` o zero vengono ricostruiti con conferma delle
perdite, evitando di riproporre la struttura problematica. Gli altri dati opachi
seguono il percorso conservativo finché non occorre ricostruire il documento.
I campi singoli (Set, I/E, D/N ecc.) usano i riferimenti scalari nativi, separati
dalle quantità delle risorse.

**Quantità MSD nei nomi.** Su richiesta dell'utente, ogni quantità esplicita diventa
un prefisso leggibile: `(0) Oggetto a quantità zero`, `(3) Tazzina blu`. L'assenza
mantiene il nome originale. Se lo stesso elemento ha più quantità si creano
varianti nel catalogo; ciascuna scena punta alla sua variante. Proprietà e
collegamenti sono riportati sulle varianti, e le Red Flags sono replicate sui
corrispondenti destinatari. La prima variante mantiene il Board ID; le successive
lo lasciano vuoto per evitare duplicazioni. Se il nome generato collide con un
elemento già esistente della stessa categoria, l'export è bloccato e spiega il
conflitto. L'app notifica sempre la trasformazione prima di scrivere il file.

Questa è una codifica testuale: MMS6 legge il numero nel nome, senza ricevere un
campo quantità nativo. Il parser non interpreta automaticamente parentesi nei
nomi importati come dati numerici, perché potrebbero essere nomi letterali. Il
progetto Studio conserva i numeri e le identità originali. Le quantità su campi
singoli non diventano nomi multipli del campo: vengono dichiarate non rappresentate.

**Catalogo completo per ogni stripboard MSD.** Un segmento MMSX diventa una
stripboard MSD. Alla sua coda Boneyard si aggiunge il complemento del catalogo
scene, dopo le strip già presenti e nell'ordine del modello comune. Ogni scena
compare esattamente una volta in ogni stripboard, programmata o nel Boneyard.
Le strip aggiunte non hanno date. Scene e banner esistenti mantengono l'ordine.
Duplicazioni nello stesso piano bloccano l'export; non vengono eliminate in silenzio.
La proiezione non modifica il progetto Studio o la partizione MMSX originale.

**Quattro definizioni sempre presenti negli MSD.** La ricostruzione le emette
anche senza entry e preserva le altre definizioni, comprese quelle inutilizzate.
Un vecchio archivio MSD che non contiene le quattro definizioni riservate viene
ricostruito con il rapporto delle trasformazioni; l'originale resta in Studio.
I nativi completi invariati continuano a essere identici byte per byte. Anche
gli eventi di sistema Studio aggiunti a un MSD nativo forzano la proiezione:
non vengono scartati dal writer conservativo.

**Eventi di sistema verso MSD.** Travel, Fitting, Rehearsal e Unavailable con
destinatari elemento diventano Red Flags per ciascun destinatario e ciascuna
data inclusiva. Il nome dell'evento e la sua nota sono conservati nella nota
della flag. Copie identiche provenienti dai calendari sono deduplicate; quantità
diverse dello stesso elemento ricevono i relativi target. Le sigle attese sono
TR, FT e R; Unavailable mantiene il vincolo di indisponibilità.

Per i destinatari elemento Travel usa 16384 e Fitting 4096, osservati nel MSD
nativo. Unavailable usa 0. Rehearsal usa il nome riservato e 0, osservato nel nuovo
campione generale; un eventuale DOODStatus Rehearsal già presente in un sorgente
viene conservato. **Non viene ipotizzato 8192 né alcun altro bit.** Il rapporto
export rende esplicito che il percorso automatico Rehearsal→R con target elemento
resta da provare in MMS6. Le flag generali mantengono 0, come nel campione ricevuto.

Gli eventi ordinari/custom e quelli senza destinatari elemento sono dichiarati
omessi in MSD. Identità, colori e portata originaria degli eventi non sono
rappresentati dal nuovo record Red Flag: restano nel progetto Studio. Quando il
calendario/segmento originale limitava l'evento a una parte dei piani, il rapporto
segnala che le Red Flags MSD hanno portata di progetto. Date e destinatari
irrisolti bloccano la conversione, anche quando l'utente accetta le perdite.

## Verifiche automatiche e prova nativa ancora necessaria

`native-regressions-v5.mjs` verifica quantità, complementi, collisioni, varianti,
collegamenti, flag derivate, date invalide e assenza di mutazioni.
`browser-native-regressions-v5.cjs` rilegge l'MSD e controlla riferimenti, quattro
definizioni e proiezione DOOD interna FT/TR/R. Il test opzionale
`browser-redflag-sample.cjs` verifica il nuovo campione, l'identità binaria e la
conservazione dello zero delle flag generali dopo modifica completa.
`browser-persistence.cjs` controlla notifiche e conferma effettiva nel dialogo.

La suite v5 è riproducibile con `tests/generate-manual-suite.cjs`; contiene
manifest, contenuti attesi, perdite dichiarate, checklist e CSV. Il caso 14 usa
date distinte per i quattro tipi, evitando sovrapposizioni di sigle. Il caso 15
contiene le quattro definizioni senza entry; il 16 esercita varianti quantità,
Board ID e collegamenti. I casi 04/07/09 verificano i complementi dei segmenti.

Apertura, resa dei report, sigle DOOD native e successivo salvataggio/riapertura
dei nuovi file **non sono stati eseguiti in questo ambiente**. In particolare
MMS6 deve verificare R dopo la conversione automatica, non soltanto dopo aver
creato una nuova flag nella propria UI. Gli esiti v4 non valgono come PASS v5.
