# Flash Studio: contratto comune minimo, versione 1

Decisioni consolidate il 7 ottobre 2026. Base verificata su GitHub: `96ad1bc2ebfc92f006d5b47eee5ff0ba2a46968c`. Implementato nella versione applicativa 1.6; la versione del contratto del modello resta 1.

## Principi e autorità dei dati

Il modello comune estende le raccolte esistenti, i componenti, i selettori e i comandi Undo/Redo. Gli adattatori determinano struttura iniziale, capacità e provenienza. Le viste non leggono direttamente JSON MMSX o XML MSD. Il modello non richiede un file importato: i futuri progetti nativi potranno alimentare le stesse raccolte, con writer e comandi aggiuntivi.

Le identità sono ID opachi e locali al documento; UUID sorgente e localizzatori legacy sono riferimenti dell'adattatore. Numero scena, nome calendario e nome visualizzato non sono chiavi comuni. In MSD i nomi restano le chiavi del writer legacy, senza imporre questo vincolo ai futuri documenti Flash. Le due schede numero 5 restano distinte.

La sorgente integra resta negli archivi già esistenti: `mmsxSource` per byte, radice originale, vista normalizzata e identità delle strip; `sourceDocument` e `sourceXmlSections` per MSD. Non si genera il file salvato serializzando soltanto il modello ridotto. Campi sconosciuti, layout e opzioni non interpretate restano nella sorgente. Una vista di consultazione non deve mutare né la sorgente né la struttura delle strip.

## Contratto implementato

| Raccolta | Campi minimi / significato |
|---|---|
| Progetto | `modelVersion`, `format` come provenienza, `capabilities`, `production`, raccolte esistenti |
| Piani (`boards`) | `id`, `parentBoardId`, `segmentId`, `name`, `calendarId`, gruppi programmati e Boneyard |
| Gruppi/giornate | `id`, `date`, `dateOrigin`, `shootingDayNumber`, strip con `sourceKey` stabile |
| Schede (`scenes`) | `id`/`bdsId`, numero scena come etichetta, `elementRefs`, `requirements` come vista di compatibilità |
| Associazione scheda–elemento | `elementId`, `category`, `name`, `quantity`, `quantityOrigin`, `resolved` |
| Elementi | `id`, categoria, nome, proprietà; dato originale MMSX conservato dall'adattatore |
| Calendari | `id`, `scope`, `sourceRef`, `scheduleDates` con `origin`, sette `daysOff`, `specialDays`, limiti di attività noti (`activityBounds`), opzioni e sorgente |
| Eventi | `id`, `sourceId`, `calendarId`, `scope`, nome, tipo, colore, nota, `startDate/endDate`, target multipli |
| Red flag | identità originale/localizzata, tipo e `typeName`, colore, nota, intervallo inclusivo, target risolto/generico/non risolto |

Per compatibilità, `boards` resta la raccolta dei segmenti normali usati dai comandi esistenti. Il selettore `boardGroups` espone le board genitrici e i segmenti; il menu delle board usa questa gerarchia invece di presentare ciascun segmento come una board separata. Ogni segmento normale MMSX diventa un piano con `parentBoardId` comune ai fratelli e un `segmentId` distinto; il Boneyard condiviso mantiene i gruppi già usati dall'editor. I suoi calendari sono raccolti separatamente con il proprio scope, senza ereditare quelli dei segmenti normali. Le identità della sorgente restano nei campi dell'adattatore già utilizzati dal writer. Nessuna seconda struttura di scheduling è introdotta.

`calendarId` è il collegamento comune; `calendarName` resta una compatibilità per il renderer e il writer MSD. I selettori accettano ID e, per i chiamanti legacy, nomi. Le viste nuove selezionano per ID. I riferimenti data→giornate vengono ricostruiti dai gruppi correnti, anche dopo riordino e Undo/Redo.

Le date sono civili ISO `YYYY-MM-DD`, senza conversioni di fuso. Gli intervalli comprendono gli estremi e tutti i giorni civili. Date invalide, tipi sconosciuti e riferimenti mancanti non sono corretti implicitamente. Uno specifico record elemento vuoto presente nel MMSX identifica una red flag generale; un UUID inesistente resta non risolto.

`quantity=null` significa quantità non disponibile o non interpretata. Il numero nel nome non viene usato per ricostruirla. Le quantità MMSX restano separate dal nome. Il precedente conteggio legacy dei report MSD conserva il suo comportamento e non è reinterpretato come quantità esplicita.

## Date e calendari

- MMSX: date delle giornate native (`stored`). Selezionare un calendario non genera altre date. Un'incoerenza rispetto alle regole è segnalata nella consultazione.
- MSD: date di ripresa inferite (`inferred`) con l'algoritmo esistente. Il selettore del calendario conserva la proiezione di lettura già disponibile, senza modificare `CalendarName` esportato.
- Le regole MMSX usano bit lunedì=0 … domenica=6. `offday`, `travel`, `holiday`, `workday` hanno traduzione esplicita. Il lavorativo forzato prevale sul riposo settimanale. Combinazioni MSD conflittuali restano non risolte.
- Start riprese, prep, end e wrap sono informazioni diverse. Non vengono sintetizzati prep/end/wrap MMSX né dedotti dall'ultima giornata. Senza prep nativo, una data prima di `prodStart` non è classificata automaticamente fuori attività.
- Le date prep/end/wrap lette da MSD sono valori presenti in quell'MSD; la sola importazione non può dimostrare se un altro programma li abbia derivati. La coppia analizzata dimostra tale derivazione per il campione, senza legittimare una regola universale per qualsiasi MSD.

## Salvataggio e conversione

**Salva** mantiene il formato importato e la sua variante: MSD 06 o variante osservata 04/MMB10/11 sezioni; MMSX 3, 5 o 3 ibrido. Senza modifiche restituisce i byte originali. Dopo modifiche strip, i writer aggiornano solo la struttura già autorizzata e preservano il resto. Per MMSX, il salvataggio ordinario conserva identità e metadati della radice; la precedente semantica di copia con nuova identità rimane un'opzione esplicita del serializer (`copy:true`), non il comportamento del pulsante Salva.

Il writer MSD conserva tutte le sezioni diverse da `StripBoardMgr` byte per byte. MMSX conserva semanticamente JSON e numeri opachi; una nuova compressione/cifratura dopo un edit non promette identità binaria. I writer rifiutano perdita o duplicazione delle strip come già avviene nell'editor.

Il futuro formato nativo Flash avrà schema versionato, ID propri e capacità di editing indipendenti dagli adattatori. Estensione e contenitore non sono decisi in questa fase. La conversione MSD↔MMSX o verso Flash sarà un comando distinto con riepilogo delle perdite prima dell'esportazione. Non viene implementata qui: eventi multi-elemento, red flag generiche/intervalli, quantità, scope, colori e calendari non usati dimostrano che non è un semplice cambio di estensione.

## Editing calendario futuro: decisione confermata dall'utente

Il primo giorno di riprese sarà l'ancora. Uno specifico comando di ripianificazione applicherà settimana ed eccezioni alle giornate successive mantenendo ordine delle strip e confini delle giornate. La transazione dovrà includere Undo/Redo, validazione e aggiornamento mirato nel formato sorgente. Nessun ricalcolo viene introdotto all'importazione.

**Eventi e indisponibilità restano alle date civili fisse, con conflitti segnalati.** Questa politica è stata confermata il 7 ottobre 2026. Non si spostano automaticamente insieme alle riprese. La prima fase ne consente solo la consultazione: nessun comando di slittamento o editing dei nuovi dati.

## Prima fase e limiti

Calendari (incluse eccezioni fuori periodo), eventi, red flag con intervalli, produzione, quantità per scheda e proprietà degli elementi sono consultabili. La voce «Dettagli progetto ed elementi» è l’ultima nella navigazione, dopo Red Flag. Le schede sono elencate in ordine alfanumerico naturale; per gli elementi si può filtrare prima la categoria e poi scegliere l’elemento. I report MMSX, la replica dei layout proprietari, le regole DOOD e il comportamento completo di `calendarOptions` restano fuori dall'implementazione; i dati sono conservati. Lo scope degli eventi è separato da quello globale delle red flag.

Il campione reale `edited2` verifica 146 schede, 4 board/piani, 8 calendari, 119 giornate, Camera Test con due target, Ernie 19–23 giugno, due red flag generiche e quantità 40 nella scena 102. Gli eventi multi-day sono coperti solo da fixture sintetiche. La struttura con più segmenti normali è stata successivamente verificata sul campione reale `PURGED.mmsx`: non si dichiara verifica Movie Magic su casi reali né sull'esportazione di questa patch.

## Verifica riproducibile

- `node tests/mmsx-production.mjs`: contratto, bit, eccezioni, scope, intervalli, ID, conservazione su 3/5/ibrido e drag+undo.
- `node tests/mmsx-production.mjs '/percorso/Wonderful Life Demo-edited2.mmsx'`: verifica aggiuntiva sul file reale, che non viene aggiunto al repository.
- Suite Node esistente e pagine browser `tests/parser.html`, `tests/roundtrip.html`, `tests/conservation.html` (selezione di un MSD locale opzionale).
- Verifica browser su `edited2.msd` per la variante osservata 04/MMB10/11 sezioni, riordino, riapertura e conservazione delle sezioni non modificate.

### Esito locale del 7 ottobre 2026

La suite Node completa passa **56 test**. La suite del modello MMSX, eseguita anche sul campione reale edited2, passa **8 test**, inclusa la corrispondenza di tutte le 119 date e dei numeri di giornata ai record nativi.

Nel browser Chromium locale passano parser, round-trip MSD e pagina di conservazione, sia sul campione MSD 06 incluso sia sull'edited2 MSD 04 osservato. Dopo un riordino, le sezioni diverse da `StripBoardMgr` sono identiche byte per byte; Undo restituisce il file originale. Verificate inoltre le viste MMSX/MSD, la separazione degli eventi per calendario, il filtro red flag per ID elemento e giorno interno all'intervallo, produzione e quantità 40 della scena 102. `git diff --check` non segnala errori. Nessun file di campione privato è stato aggiunto al repository.

## Gestione delle board e dei segmenti

`assets/board-segments.js` deriva le board genitrici da `parentBoardId`, con nomi e ordine dei segmenti forniti dall’adattatore MMSX. `boardGroups` ed `entriesForBoard` restituiscono riferimenti agli stessi gruppi dell’editor: nessuna copia delle strip e un solo Boneyard condiviso. Nel formato MSD restano le board legacy; i nomi non sono usati per inferire gerarchie che il file non conserva.

Il menu «Sub-board» sostituisce «Visualizza Boneyard» e sceglie indipendentemente quali segmenti mostrare. All’apertura sono visibili i segmenti normali; il Boneyard si aggiunge dal menu. Le preferenze di visibilità non modificano il documento. La vista mantiene l’ordine dei segmenti normali e mostra il Boneyard in coda e introduce soltanto un’etichetta discreta e 12 px di separazione. Entrambi sono esclusi dalla stampa.

Le posizioni di editing includono il piano/segmento proprietario. Trascinamento e F2 possono spostare scene, banner e confini di giornata tra segmenti dello stesso parent; le selezioni miste mantengono l’ordine visibile. I comandi operano su una vista temporanea dei gruppi esistenti e ripartiscono i risultati nei segmenti originali. Undo/Redo conserva l’intera famiglia, incluso il Boneyard condiviso. I trasferimenti fra board genitrici diverse vengono rifiutati. Le date restano specifiche del segmento; un confine nativo privo di data resta privo di data anche se spostato, senza inventare una shooting date.

Verificato su `PURGED.mmsx`: una board `Default`, segmenti `Default`, `Boneyard`, `Sub-board 2`, quattro schede e quattro strip scena distinte nell’unione dei segmenti. Nessun dato del campione privato viene incluso nel repository. Test riproducibile: `node tests/board-segments.mjs '/percorso/PURGED.mmsx'`. La suite senza argomenti usa solo dati sintetici e copre anche MMSX 3 e 3 ibrido. Nel browser sono verificati visibilità, stampa, trascinamento diretto, F2, Undo/Redo e il ciclo completo salva→riapri. Rimane da verificare la riapertura di questi export in Movie Magic.

Nella versione 1.7, il Boneyard è presentato in coda, senza modificare il suo `sortOrder` originale. Il menu è contenuto nel pannello anche su viewport stretti. La checkbox «Bianco e nero» è affiancata alle opzioni di visualizzazione e stampa: quando attiva, scene, banner e fine giornata usano fondo bianco e testo nero; disattivandola si ripristinano i colori del file, senza modificare il documento. Badge e azioni della barra superiore possono disporsi su righe separate su schermi piccoli.
