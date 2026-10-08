# Calendar operativo e Anteprima Spoglio — v1.8

Implementazione dell’8 ottobre 2026. Le note delle fasi precedenti restano evidenza storica; questa fase abilita l’editing dei calendari.

## Uso

**Calendar** è la vista mensile del piano con regole e date modificabili nello stesso spazio. La griglia lunedì–domenica contiene riepiloghi, pagine, stime, conteggi, scene e banner nell’ordine originale, eventi, Red Flags e conflitti. Le celle crescono in altezza in base a tutte le strip contenute, senza scroll interno. Le strip compatte mostrano numero scena, set e pagine in ottavi; «Vista → Strip estese» aggiunge INT/EXT, DAY/NIGHT e synopsis. Il dettaglio della data mostra le synopsis complete nella modalità estesa. Tutti/Nessuno agisce sulla visibilità dei contenuti e non cambia la modalità compatta/estesa. Le righe senza riprese rimangono visibili. Si naviga con mese precedente/successivo, mese diretto, «Vai alla data» e «Inizio riprese».

**Calendario consultato** è una scelta di lettura per ID. Vengono mostrati solo i segmenti visibili della board corrente effettivamente associati a quel calendario. Se nessuno è associato, la griglia mostra le regole, gli eventi e le flag della data senza attribuire date a piani diversi. I calendari Boneyard conservano il loro scope; nessuna scena non programmata viene inserita nella griglia. Le giornate native senza data e i gruppi programmati senza giornata rimangono disponibili in un elenco distinto. In Stripboard resta disponibile la proiezione MSD legacy; il cambio di calendario non modifica il collegamento salvato.

**Regole e date** apre il pannello secondario. «Segmento da modificare» sceglie il piano proprietario; nome del calendario associato e lista dei piani che lo usano sono sempre visibili prima di modificare le regole. Il pannello non modifica automaticamente il calendario consultato. Supporta i sette riposi ricorrenti, eccezione lavorativa / Off Day / Holiday / Company Travel, rimozione dell’eccezione, inizio riprese e uso della data selezionata come inizio. Le modifiche sono transazioni; non spostano le riprese.

**Anteprima ripianificazione** mostra tutti i piani/segmenti associati, anche quelli nascosti o in altre board, numero di date che cambiano, intervallo risultante e tabella prima/dopo. «Applica» esegue una transazione distinta. La prima giornata rimane esattamente sull’ancora anche se non lavorativa: il conflitto viene mostrato. Le successive seguono le regole. Ordine, confini, giornate vuote e numeri nativi di giornata sono preservati. Eventi e Red Flags restano alle date civili originarie. Una regola non risolta interrompe l’anteprima; un’anteprima divenuta obsoleta viene rifiutata prima di modificare il modello. Non si inferiscono nuovi prep/end/wrap.

Il menu **Vista** controlla riepiloghi, pagine, tempi, conteggi, strip, banner, eventi, flag, conflitti e sabato/domenica, con Tutti/Nessuno. Sono preferenze della sessione e non modificano il documento. Date nascoste restano accessibili nel dettaglio tramite Vai alla data. Anche cambiare board per consultazione ora lascia il documento invariato; `ActiveStripBoard` sorgente resta conservato.

**Anteprima Spoglio** segue la scena attiva dalla Stripboard e dal calendario. Mostra contesto del piano/occorrenza, data e shooting day, campi disponibili, synopsis, categorie del progetto nell’ordine del template ed elementi con il solo ID visualizzabile (quando presente) e nome. Quantità e proprietà restano conservate nel modello e consultabili in Dettagli progetto ed elementi, senza affollare la preview. Le categorie assenti dal template e i riferimenti non risolti restano disponibili; un riferimento non risolto è segnalato nel tooltip dell’elemento. La checkbox delle categorie vuote è una preferenza UI. La multiselezione mostra la scena attiva, distinguendo l’ID scheda dall’ID dell’occorrenza.

Gli affiancamenti Stripboard + Spoglio, Calendar + Spoglio e Calendar + Stripboard sono attivati dall’utente **solo oltre 1200 CSS px**. Le stesse viste vengono riutilizzate, con separatore trascinabile o comandabile con frecce/Home/End, e scroll indipendenti. A 1200 px e sotto rimane una vista principale; lo spoglio usa un drawer. Tornare sopra soglia non attiva un layout mai scelto. Selezione, contesto, scroll e campi data in corso sono conservati nei cambi di layout. Le preferenze non sono persistite nel file.

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

**Suite Node:** 79 test passati, senza file privati. La nuova suite calendario passa 10 test quando viene aggiunto il caso reale edited2. `git diff --check` passa.

**Fixture sintetiche:** MMSX 5/3/ibrido; sette giorni, tutti i tipi di eccezione e rimozione; start separato dalle riprese; invalidità e anteprima obsoleta; più segmenti/calendari, calendario condiviso nel modello, giornate vuote e duplicate su una data; banner nell’ordine, eventi multi-day, indisponibilità, quantità 2 dell’elemento «12 auto», categoria custom con colore/proprietà e riferimento mancante; render senza mutazioni. La selezione distingue più occorrenze della stessa scena. Questi casi non sono prove del comportamento Movie Magic.

**File reali:** MSD 06 `samples/Wonderful Life Demo.msd`; MSD 04/MMB10/11 sezioni `Wonderful Life Demo-edited2.msd`; MMSX edited2 e `PURGED.mmsx` locali, non aggiunti al repository. Verificati i writer e la conservazione, regole senza ripianificazione implicita, ripianificazione esplicita, Undo/Redo e salvataggio/riapertura. Edited2 MMSX conserva breakdown, categorie, elementi, Red Flags e identità; PURGED conserva gerarchia e segmenti. I test del modello reale edited2 verificano anche quantità 40, 119 date native ed eventi con due target.

**Browser Chromium locale:** passano parser, roundtrip strutturale, conservation e calendar-roundtrip; il nuovo roundtrip passa anche sull’MSD 04 reale. Passano selezione da Stripboard/Calendar, multiselezione, tutti i tre affiancamenti, ridimensionamento via tastiera, 1199/1200/1201 px, nessuna apertura automatica, drawer, categorie custom/proprietà/riferimenti non risolti, Tutti/Nessuno e weekend, campi in corso durante cambio layout, consultazione di più board/calendari senza dirty state o differenze binarie, editing reale e download→importazione tramite controlli UI per MSD e MMSX. La prova automatizzata usa il download di fallback; il picker File System Access nativo non è automatizzato.

### Rifinitura densità del calendario

La modalità compatta predefinita mostra soltanto numero scena, set e pagine in ottavi. La checkbox «Strip estese» nel menu Vista ripristina i dettagli di scena; è separata dai comandi Tutti/Nessuno. Le celle non hanno max-height né scrollbar interne: l’altezza di ogni riga del mese segue la giornata con più contenuto. L’eventuale scroll della vista intera nei pannelli affiancati rimane indipendente.

`tests/browser-calendar-density.cjs` verifica nel browser una fixture MMSX con 40 occorrenze di scena e un banner: tutte le strip rientrano nell’altezza naturale della cella, anche oltre il precedente limite di 310 px. Verificate modalità compatta/estesa, crescita della cella, selezione preservata, assenza di dirty state, Tutti/Nessuno senza cambio di densità, layout singolo/affiancato e soglia 1200/1201 px. La suite Node calendario passa 9 test senza file reali. Questo controllo di una giornata lunga usa dati sintetici. Parametro del test: `LONG_DAY_MMSX=/percorso/calendar-long-day.mmsx`, con lo stesso runtime Playwright descritto sopra.

## Limiti residui

Non è stata verificata la riapertura degli export calendario in Movie Magic Scheduling. In particolare il namespace Studio potrebbe essere ignorato o eliminato da Movie Magic: le date congelate MSD hanno garanzia di round-trip in Stripboard Studio, non una garanzia di mantenimento in programmi terzi. Le modifiche native di DaysOff/SpecialDays/Start usano la semantica supportata ma l’interpretazione di combinazioni proprietarie sconosciute resta fuori scope. SpecialDays MSD duplicati sulla stessa data vengono rifiutati dall’editor, senza perdita dei record. I pattern settimanali non risolti non sono sostituiti automaticamente.

Drag & drop dal calendario, editing eventi/Red Flags, editing dello spoglio, conversioni, regole DOOD complete, calendarioOptions proprietarie e persistenza delle preferenze UI restano fuori da questa fase. Safari/iPad e la resa del picker nativo restano da verificare. Nessun file privato viene distribuito.

### Correzione drag in Calendar + Stripboard

Il gestore del puntatore ora abilita le interazioni quando il pannello Stripboard è visibile, anche con Calendar come area principale. Il controllo precedente dipendeva esclusivamente dalla scheda principale e bloccava mouse/touch nel layout affiancato. Se il pannello è nascosto, resta inattivo. Escape segue la stessa regola. Il drag riutilizza `moveBoardItems` e la history comune; lo scorrimento automatico verticale agisce sul pannello Stripboard quando ha scroll indipendente.

Passano 33 test pertinenti di interazione/spostamento, inclusi selezione mouse/touch con Calendar attivo, pannello nascosto, instradamento del drag al comando condiviso e autoscroll del pannello. La verifica manuale nel browser integrato usa il campione MSD 06 incluso: trascinata la scena 12 dalla prima alla seconda giornata nel layout Calendar + Stripboard, verificato l’aggiornamento della cella del 18 giugno e Undo/Redo. La suite browser riproducibile include ora anche questo drag con eventi reali del mouse.
