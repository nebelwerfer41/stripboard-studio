# Calendar, layout e Spoglio — v1.18

## Uso corrente

Calendar legge il piano associato al calendario scelto. Cambiare calendario dal selettore aggiorna il collegamento del piano e ricalcola le sue giornate secondo riposi ricorrenti ed eccezioni. L’importazione lascia intatte le date native. Non vengono mostrate etichette di date inferite/proiezioni, né un’anteprima di ripianificazione.

Il selettore calendario contiene **Nuovo calendario**, **Modifica calendario** e **Riordina**; il selettore piano offre le azioni equivalenti per le Stripboard. Le definizioni native dedicate soltanto al Boneyard non compaiono fra i calendari operativi, ma sono conservate nei dati sorgente. Sub-board mostra solo i segmenti programmati; il Boneyard rimane una coda separata in Stripboard.

**Modifica calendario** apre un unico overlay: nome, prep/start/end/wrap, sette riposi settimanali, eccezioni lavorative/Off Day/Holiday/Company Travel, aggiunta/sostituzione e rimozione. Salva applica calendario e date dei piani associati insieme; Annulla/Escape/clic esterno scartano la bozza. I campi proprietari sconosciuti sono conservati; non è disponibile l’aggiunta di nuovi campi. La prima giornata cade sul primo giorno lavorativo a partire dall’inizio riprese, le successive seguono le regole. Se manca qualunque data iniziale si usa la data locale corrente. Una regola non risolta blocca l’operazione senza modifiche parziali. Si conserva il numero della prima giornata e si numerano consecutivamente le successive. Eventi e Red Flags mantengono le date civili originarie.

**Fine giornata** in Stripboard inserisce un confine nel punto selezionato e fa slittare le giornate secondo il calendario corrente. Nessun campo data o numero richiesto. Scene e banner si creano direttamente dopo la selezione; Spoglio apre la nuova scena, il banner mostra i campi nella barra del piano. Se si seleziona il termine di una giornata già chiusa non viene creato un secondo confine.

Calendar offre mese precedente/successivo, mese diretto, Vai alla data, Inizio riprese, impostazioni, multiselezione ed eventi. Le checkbox permettono di selezionare più strip; restano disponibili modificatori della tastiera e long press. Doppio clic su una strip apre Stripboard con quella strip selezionata e visibile. Drag, F2, Annulla/Ripeti e trasferimenti fra viste usano la stessa selezione/history. Le celle crescono con il contenuto, senza scroll interno; telefoni usano un’agenda compatta con Mostra mese.

**Visualizzazione** riunisce layout, campi, categorie, visibilità e stampa; le preferenze Stripboard e Calendar sono indipendenti. **Colori strip** è un overlay separato con INT/EXT × D/N e colori speciali. Le preferenze visuali non modificano il documento. Pagine in frazioni di ottavi, tempo stimato HH:MM e tempo schermo MM:SS valgono in Spoglio e nelle viste. Sheet è di sola lettura e automatico.

Gli affiancamenti sono nella barra principale, disponibili oltre 1200 CSS px, con ciascun pannello fra il 25 e il 75% della larghezza. A dimensioni minori rimane una vista intera, con accesso diretto a Spoglio. Il cambio di layout conserva il contesto.

## Verifiche v1.18

`node --test tests/*.mjs`: 155 test passati. `browser-workspace-revision.cjs` copre i flussi correnti su MSD, salvataggio/riapertura Studio e archivio originale. `browser-calendar-selection.cjs` e `browser-calendar-rules.cjs` verificano MMSX 3/5/ibrido, associazione effettiva, ripianificazione, salvataggio, Undo/Redo e byte originali dopo Undo. Passano anche calendario denso, sette viewport responsive, drag fra viste, adattatori nativi e DOOD/PDF.

I nuovi comandi completi si salvano in Studio v2, conservando l’archivio importato; gli export MSD/MMSX rimangono conservativi. Non si dichiara interoperabilità delle modifiche complete con Movie Magic. Vedi [persistenza e compatibilità](document-editing.md).

## Audit storico degli adattatori e delle versioni precedenti

Le sezioni seguenti documentano le implementazioni precedenti alla v1.18, incluse le API conservative ancora verificate. Le descrizioni di menu Vista/Strip, consultazione in sola lettura e anteprima ripianificazione non descrivono più l’interfaccia corrente.

## Modello, selectors e transazioni

- Riutilizzati `boardGroups`, `entriesForBoard`, `boardGroupForPlan`, `findCalendar`, `calendarDate`, `eventsOnDate`, `redFlagsOnDate`, `redFlagsForStrip`, i comandi strutturali e le snapshot di `scheduling.js`. Nessuna nuova collezione autonoma di scene/giornate/eventi.
- `assets/calendar-selectors.js`: `calendarPlanEntries`, `calendarDayContent`, `groupSummary`, `estimateMinutes`, `activeSceneContext`, `breakdownCategories`, `canSplit`. Le raccolte risultanti sono proiezioni del modello. I conflitti riguardano riprese non lavorative/fuori attività e flag con tipo normalizzato `unavailable`; tipi sconosciuti e flag MSD dal significato non verificato restano segnalazioni, senza dedurne vincoli.
- `assets/calendar-commands.js`: `editCalendar`, `plansForCalendar`, `previewReschedule`, `rescheduleCalendar`, `snapshotProduction`, `restoreProduction` e firme per il salvataggio. Le snapshot comprendono calendario e date/gruppi di tutti i piani, senza clonare o sostituire le strip. La stessa history dell’app alterna operazioni strip e operazioni calendario; Undo/Redo e scorciatoie funzionano in entrambe le aree. I comandi non modificano gli archivi sorgente.
- `strip-interaction.js` accetta `sceneIdForKey` e mantiene `activeSceneId` separato da `activeStripId` e `selectedStripIds`. La preview si aggiorna anche durante multiselezione e Undo/Redo.
- `assets/workspace-views.js` rende Calendar e Spoglio esclusivamente dal modello e dai selectors. `renderBoard` è lo stesso componente usato singolo e affiancato. Nessun XML/JSON proprietario viene interpretato nelle viste.
- I tempi MSD numerici sono minuti; MMSX usa `estHours`/`estMinutes`. Una somma con tempi assenti viene etichettata «parziale». Le categorie conservano ID, ordine e colore normalizzati; le quantità restano separate dai nomi.

## Fattibilità e conservazione dei writer

La verifica preliminare ha individuato `CalendarMgr/Calendars/Calendar` per MSD e `segment.calendar` per MMSX, comprese le varianti array/map/ibrida. Il limite strutturale MSD è l’assenza di date native per `ScheduleDay`: salvare soltanto le nuove regole provocherebbe una ripianificazione implicita alla riapertura. Perciò Studio conserva esplicitamente la precedente inferenza fino al comando di ripianificazione.

**MSD:** `CalendarMgr` viene riscritto solo quando cambia un calendario, preservando gli altri nodi/attributi della sezione. Sono aggiornati i sette attributi `DaysOff`, le sole eccezioni interessate e `ProductionStartDate`; RedFlagMgr, breakdown, elementi, layout e tutte le altre sezioni restano identici byte per byte. Le giornate dei piani associati conservano la data con attributi XML `flash:date` e `flash:dateOrigin`, namespace `https://stripboard.studio/ns/calendar/1`, nella sezione StripBoardMgr. Un attributo vuoto conserva una giornata senza data. Sono dati di Stripboard Studio, non date native Movie Magic. Il parser riconosce il namespace; una ripianificazione aggiorna gli attributi. Spostare un confine nel Boneyard rimuove le date Studio dal nodo esportato. Undo completo produce di nuovo i byte importati.

**MMSX:** il writer parte dal JSON originale, cambia `daysOff`, `specialDays` e `prodStart` del solo calendario modificato. Eventi, opzioni, calendari estranei, proprietà opache, numeri esatti, identità della radice e versione sono conservati. La ripianificazione aggiorna i record di strip/giornata dei segmenti interessati con il writer strutturale esistente. `restoreMmsxV3` ora riporta anche gli aggiornamenti calendario negli array originali o nelle mappe autorevoli della variante ibrida, mantenendo i placeholder legacy. Nessuna migrazione di formato. Dopo riapertura le date MMSX sono nuovamente classificate `stored` perché lette dai record nativi.

Senza modifiche entrambi i writer restituiscono i byte originali. Gli errori di serializzazione non segnano il documento come salvato.

## Verifiche riproducibili ed esito

```sh
node --test tests/*.mjs
node tests/calendar-workspace.mjs '/percorso/Wonderful Life Demo-edited2.mmsx'
node tests/mmsx-production.mjs '/percorso/Wonderful Life Demo-edited2.mmsx'
node tests/board-segments.mjs '/percorso/PURGED.mmsx'
```

`tests/calendar-roundtrip.html` esegue i controlli MSD sul campione reale incluso ed espone un input per varianti reali locali. `tests/browser-workspace.cjs` usa Playwright e un server locale; `NODE_PATH` può indicare un runtime con Playwright e `CHROME_PATH` un Chrome locale. `STUDIO_URL`, `STUDIO_TEST_OUTPUT`, `REAL_MSD`, `REAL_MMSX`, `SYNTHETIC_MMSX`, `PURGED_MMSX` sono parametri opzionali. I download e le screenshot di QA vengono scritti in una directory temporanea. Per generare il file sintetico: importare `fixture` da `tests/fixtures/calendar.mjs` e codificarlo con `encodeMmsx`.

`CHROME_PATH=/usr/bin/chromium node tests/browser-calendar-selection.cjs` verifica il cambio di calendario tramite la UI: giornate e scene MSD coerenti con la proiezione Stripboard, ritorno al calendario originale e salvataggio byte-identico. Per MMSX 5/3/ibrido genera fixture con calendari alternativi che iniziano in un altro anno e verifica date native, mese, data selezionata, selezione scena, sub-board nascoste e salvataggio byte-identico, anche consultando il calendario Boneyard. Usa lo stesso server locale e runtime Playwright delle altre suite.

`CHROME_PATH=/usr/bin/chromium node tests/browser-calendar-rules.cjs` verifica su MSD e MMSX 5/3/ibrido che il pannello segua il calendario selezionato, mantenga le bozze separate e salvi riposi, eccezioni e inizio sul solo calendario scelto. Controlla il calendario e i piani coinvolti nella ripianificazione, la conservazione degli altri calendari e delle date dopo Undo della ripianificazione, e il ripristino byte-identico dopo Undo di tutte le modifiche.

**Suite Node:** 79 test passati, senza file privati. La nuova suite calendario passa 10 test quando viene aggiunto il caso reale edited2. `git diff --check` passa.

**Fixture sintetiche:** MMSX 5/3/ibrido; sette giorni, tutti i tipi di eccezione e rimozione; start separato dalle riprese; invalidità e anteprima obsoleta; più segmenti/calendari, calendario condiviso nel modello, giornate vuote e duplicate su una data; banner nell’ordine, eventi multi-day, indisponibilità, quantità 2 dell’elemento «12 auto», categoria custom con colore/proprietà e riferimento mancante; render senza mutazioni. La selezione distingue più occorrenze della stessa scena. Questi casi non sono prove del comportamento Movie Magic.

**File reali:** MSD 06 `samples/Wonderful Life Demo.msd`; MSD 04/MMB10/11 sezioni `Wonderful Life Demo-edited2.msd`; MMSX edited2 e `PURGED.mmsx` locali, non aggiunti al repository. Verificati i writer e la conservazione, regole senza ripianificazione implicita, ripianificazione esplicita, Undo/Redo e salvataggio/riapertura. Edited2 MMSX conserva breakdown, categorie, elementi, Red Flags e identità; PURGED conserva gerarchia e segmenti. I test del modello reale edited2 verificano anche quantità 40, 119 date native ed eventi con due target.

**Browser Chromium locale:** passano parser, roundtrip strutturale, conservation e calendar-roundtrip; il nuovo roundtrip passa anche sull’MSD 04 reale. Passano selezione da Stripboard/Calendar, multiselezione, tutti i tre affiancamenti, ridimensionamento via tastiera, 1199/1200/1201 px, nessuna apertura automatica, drawer, categorie custom/proprietà/riferimenti non risolti, Tutti/Nessuno e weekend, campi in corso durante cambio layout, consultazione di più board/calendari senza dirty state o differenze binarie, editing reale e download→importazione tramite controlli UI per MSD e MMSX. La prova automatizzata usa il download di fallback; il picker File System Access nativo non è automatizzato.

### Rifinitura densità del calendario

La modalità compatta predefinita mostra soltanto numero scena, set e pagine in ottavi. La checkbox «Strip estese» nel menu Vista ripristina i dettagli di scena; è separata dai comandi Tutti/Nessuno. Le celle non hanno max-height né scrollbar interne: l’altezza di ogni riga del mese segue la giornata con più contenuto. L’eventuale scroll della vista intera nei pannelli affiancati rimane indipendente.

`tests/browser-calendar-density.cjs` verifica nel browser una fixture MMSX con 40 occorrenze di scena e un banner: tutte le strip rientrano nell’altezza naturale della cella, anche oltre il precedente limite di 310 px. Verificate modalità compatta/estesa, crescita della cella, selezione preservata, assenza di dirty state, Tutti/Nessuno senza cambio di densità, layout singolo/affiancato e soglia 1200/1201 px. La suite Node calendario passa 9 test senza file reali. Questo controllo di una giornata lunga usa dati sintetici. Parametro del test: `LONG_DAY_MMSX=/percorso/calendar-long-day.mmsx`, con lo stesso runtime Playwright descritto sopra.

## Limiti residui

Non è stata verificata la riapertura degli export calendario in Movie Magic Scheduling. In particolare il namespace Studio potrebbe essere ignorato o eliminato da Movie Magic: le date congelate MSD hanno garanzia di round-trip in Stripboard Studio, non una garanzia di mantenimento in programmi terzi. Le modifiche native di DaysOff/SpecialDays/Start usano la semantica supportata ma l’interpretazione di combinazioni proprietarie sconosciute resta fuori scope. SpecialDays MSD duplicati sulla stessa data vengono rifiutati dall’editor, senza perdita dei record. I pattern settimanali non risolti non sono sostituiti automaticamente.

Editing eventi/Red Flags, editing dello spoglio, conversioni, regole DOOD complete, calendarioOptions proprietarie e persistenza delle preferenze UI restano fuori da questa fase. Safari/iPad e la resa del picker nativo restano da verificare. Nessun file privato viene distribuito.

### Correzione drag in Calendar + Stripboard

Il gestore del puntatore ora abilita le interazioni quando il pannello Stripboard è visibile, anche con Calendar come area principale. Il controllo precedente dipendeva esclusivamente dalla scheda principale e bloccava mouse/touch nel layout affiancato. Se il pannello è nascosto, resta inattivo. Escape segue la stessa regola. Il drag riutilizza `moveBoardItems` e la history comune; lo scorrimento automatico verticale agisce sul pannello Stripboard quando ha scroll indipendente.

Passano 33 test pertinenti di interazione/spostamento, inclusi selezione mouse/touch con Calendar attivo, pannello nascosto, instradamento del drag al comando condiviso e autoscroll del pannello. La verifica manuale nel browser integrato usa il campione MSD 06 incluso: trascinata la scena 12 dalla prima alla seconda giornata nel layout Calendar + Stripboard, verificato l’aggiornamento della cella del 18 giugno e Undo/Redo. La suite browser riproducibile include ora anche questo drag con eventi reali del mouse.


### Navigazione superiore e dispositivi piccoli

La UI usa la larghezza dello schermo per i contenuti e mantiene separati i controlli dallo scroll delle viste. Il selettore progetto è nel titolo; layout e opzioni si trovano in «Visualizzazione». A 620 px e sotto, le strip diventano righe con numero, set, INT/EXT, giorno/notte, pagine e sinossi; l’impaginazione di stampa resta quella importata. Calendar propone un’agenda di riprese, eventi, segnalazioni e data selezionata; «Mostra mese» rende disponibile la griglia completa. Le date senza contenuti restano consultabili dalla griglia o da «Vai alla data». Spoglio è una vista intera anche da telefono.

`tests/browser-responsive.cjs` verifica le sei voci della navigazione a 320, 390, 768, 1024, 1199, 1200 e 1201 px; le dimensioni effettive di tutti gli affiancamenti ai limiti 25/75 via mouse e tastiera; la conservazione del contesto di scena; l’agenda e il mese; il salvataggio senza modifiche byte-identico; spostamento e Undo delle strip su telefono per layout orizzontali e verticali. Esecuzione con Playwright e Chromium: `CHROME_PATH=/percorso/chromium node tests/browser-responsive.cjs`, con il server statico su `http://127.0.0.1:8766` (oppure `STUDIO_URL`).

### Layout standard e drag tra viste — v1.9

«Visualizzazione → Layout Stripboard» conserva i layout del file e aggiunge Compatto, Dettagliato e Produzione. Nei layout standard si scelgono i campi delle scene e le categorie di elementi. Calendar usa preferenze indipendenti nel menu «Strip». Ogni configurazione mantiene almeno un campo; una modifica diventa «Personalizzato». Le scelte valgono per la sessione e non riscrivono layout o schede sorgente. Le strip standard occupano tutta la larghezza del pannello, anche da telefono, e vengono stampate con i campi scelti.

Scene e banner in Calendar condividono selezione, multiselezione, long press, F2 e history con la Stripboard. Il punto di inserimento permette riordino nella stessa giornata e spostamenti fra giornate; i due pannelli si scambiano strip direttamente. Nella vista singola, tenere il drag sulla scheda superiore dell’altra vista per 500 ms la apre mantenendo il drag. Lo scroll automatico segue il pannello sotto il puntatore. Escape e il rilascio fuori da una destinazione annullano il drag senza modificare il piano. I day break restano gestibili nella Stripboard.

Un drop su una data senza riprese crea una giornata nel segmento visibile associato al calendario consultato: preferisce il segmento sorgente se associato, poi il piano corrente se associato, poi il primo associato visibile. Calendari estranei alla board non sono destinazioni. Le date esistenti e le regole non vengono ripianificate. Su una data non lavorativa il piano resta visibile con il conflitto esistente.

MSD conserva tutte le date della board interessata con il namespace Studio già descritto e numera le giornate secondo l’ordine strutturale del formato. MMSX aggiunge un record nativo `day` con ID nuovo e numero successivo all’ultimo del segmento, mantenendo i numeri originali. I writer continuano a richiedere ogni identità sorgente esattamente una volta; solo i nuovi confini esplicitamente creati sono ammessi in aggiunta. Undo elimina la nuova giornata e ripristina i byte importati se non restano altre modifiche. Nessun archivio sorgente viene mutato dalla transazione.

Verifiche aggiuntive: `tests/strip-display.mjs`, `tests/calendar-drag.mjs` (MMSX 5/3/ibrido), nuova creazione di giornate in `tests/calendar-roundtrip.html` sul campione MSD incluso e `tests/browser-strip-layouts-drag.cjs`. Quest’ultima usa puntatori reali per riordino, cross-view, cancellazione, salvataggio/riapertura e Undo/Redo; verifica anche passaggio via schede a 1024/390 px ed eventi touch nativi per long press e multiselezione su telefono. La riapertura in Movie Magic e Safari/iPad reali restano da verificare.
