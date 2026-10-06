# Supporto MMSX

L’integrazione del 6 ottobre 2026 aggiunge lettura e scrittura locale dei contenitori MMS2/MMSX con `dataFormat: 3` e `dataFormat: 5`. Il formato viene riconosciuto dalla firma del contenuto. I file MSD continuano a usare il parser e il writer originali.

## Utilizzo

Avvia Stripboard Studio con il launcher o un server HTTP locale. Scegli **Importa .msd / .mmsx**, seleziona il piano/sub-board e usa **Visualizza Boneyard** per le strips non programmate. Selezione, trascinamento, F2, **Annulla** e **Ripeti** mantengono le interazioni della versione corrente.

**Esporta copia .mmsx** genera un nome univoco e una nuova identità, rimuovendo i metadati di condivisione e il percorso originale. Il Boneyard è condiviso tra i sub-board dello stesso piano MMSX. L’esportazione aggiorna ordine, data, numero di giornata e totale degli ottavi dei segmenti modificati; verifica le identità per impedire strips perse o duplicate. I dati non interpretati e i numeri oltre la precisione JavaScript vengono conservati.

Esporta prima di chiudere: non è presente salvataggio automatico della bozza. Su iPad conserva il download in **Sul mio iPad**. Non è disponibile conversione tra MSD e MMSX.

## Limiti

La vista compatta mostra scene, banner, giornate e colori; non riproduce i layout proprietari MMSX. Report, calendari, red flag, creazione di piani e modifica delle schede sono disabilitati per MMSX, con i dati originali conservati nell’esportazione. Le date e i numeri di giornata sono quelli memorizzati nel file. Banner e fine giornata, inclusi quelli già nel Boneyard, sono selezionabili e spostabili in entrambe le direzioni, anche in selezioni miste. Shift+clic seleziona un intervallo di strip visibili; Ctrl/⌘-Shift+clic lo aggiunge alla selezione.

Sono richiesti CompressionStream/DecompressionStream gzip e le API crittografiche del browser, disponibili su HTTPS o localhost. Limiti: 64 MB per il contenitore e 128 MB dopo decompressione. Il supporto è limitato a dataFormat 3 e 5.

## Verifiche riproducibili

```sh
node tests/mmsx.mjs
node --test tests/mmsx-v3.mjs
node --test tests/document-state.mjs tests/element-format.mjs tests/production-data.mjs tests/report-layout.mjs tests/strip-drag.mjs tests/strip-interaction.mjs
```

Il test MMSX usa un piano sintetico incluso in `tests/fixtures/mmsx.mjs`, con due sub-board, due giornate con numerazione non consecutiva e un Boneyard condiviso. Verifica codec, firma MMS2/MMSX, numeri esatti, conservazione dei dati, spostamenti tra giornate e Boneyard, trasferimento tra sub-board, annullamento/ripetizione dei fine giornata, esportazione/reimportazione, trasferimenti dei fine giornata originali del Boneyard e rifiuto di file malformati o strips duplicate.

Per eseguire i controlli del formato 5 su un piano reale con almeno due giornate e un Boneyard:

```sh
node tests/mmsx.mjs /percorso/piano.mmsx /percorso/copia-test.mmsx
```

I 32 test Node preesistenti e tutti i controlli del round-trip MSD in `tests/roundtrip.html` sono passati dopo l’integrazione. Nessun piano privato è incluso. La verifica nel browser locale ha confermato rendering, colori, funzioni disabilitate, spostamento al Boneyard, Annulla/Ripeti e condivisione tra sub-board mediante un caricatore temporaneo del piano sintetico. Il browser integrato non ha esposto gli eventi di scelta file e download: non è stato possibile automatizzare il ciclo completo tramite quei controlli. Esportazione e reimportazione binarie sono state verificate in Node. La riapertura in Movie Magic Scheduling e la prova su Safari/iPad restano da effettuare con un piano reale.

Il formato 3 usa array ordinati di schede, segmenti e strips. L’adattatore li espone al modello corrente senza migrare il documento: l’esportazione mantiene dataFormat 3 e modifica solo gli array dei segmenti interessati. Verificati importazione, spostamento, esportazione/reimportazione e annullamento anche su un piano reale formato 3; il file originale non viene modificato.

Alcuni file dichiarano dataFormat 3 ma includono già `sheetMap`, `segmentMap` e `stripMap`, insieme ad array di compatibilità contenenti «This schedule requires MMS 10.10 or newer». Quando presenti, le mappe sono autorevoli: il parser le legge e il writer aggiorna soltanto le mappe modificate, mantenendo gli array segnaposto originali. Verificati importazione completa, spostamento, esportazione/reimportazione e annullamento su questo schema ibrido.
