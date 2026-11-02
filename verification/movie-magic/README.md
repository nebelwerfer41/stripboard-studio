# Suite candidata v6 — MMS6 / MMS10

**Verificata con i parser di Stripboard Studio; NON certificata da Movie Magic.**
I risultati di apertura, report e salvataggio/riapertura MMS6/MMS10 sono ancora
DA ESEGUIRE. Le versioni precedenti restano negli ZIP versionati. Il riscontro
v5, con gli hash originali, è in `history/manual-feedback-v5.json` nel pacchetto.
Sono distribuiti solo dati sintetici, con licenza MIT del repository: nessun
archivio del demo o del nuovo `redflags.msd` è copiato nella suite.

## Riproduzione

Node 24+, Chromium e Playwright; dalla cartella del repository:

```sh
python -m http.server 8766 --bind 127.0.0.1
# Altro terminale:
CHROME_PATH=/usr/bin/chromium node tests/generate-manual-suite.cjs
```

`STUDIO_URL` e `STUDIO_MANUAL_OUTPUT` cambiano server e cartella di output.
Il seed 271828 è applicato soltanto alla pagina del generatore, non all'app.
Tutti gli export sono riletti, confrontati con il modello corrente e con le
trasformazioni dichiarate. `automatic-checks.json` contiene il log e il manifest
i contenuti attesi e gli SHA-256. Il generatore riscrive il CSV: conservare i
risultati manuali compilati prima di rigenerare.

## Contenuto e casi

| Caso | Prova principale |
|---|---|
| 01 / 01b | Nuovo vuoto / una scena nel Boneyard; I/E e D/N non impostati intenzionalmente |
| 02 | Scene, accenti, quantità assente/zero/3, cataloghi, proprietà, due piani, giornate, banner, calendari, evento fitting e Red Flag su intervallo |
| 03 / 04 | Import modificati e conversioni MSD↔MMSX; 04 ha segmenti distinti e Boneyard condiviso |
| 05–07 | Salvataggio e riapertura Studio v3; allegati i contenitori Studio |
| 08 | Nativi sintetici invariati, export identico byte per byte |
| 09 | Migrazioni Studio v1/v2 con sorgente sintetico conservato |
| 10 | Controlli MSD separati: tempo, Unicode, proprietà, giornata vuota, Red Flag, secondo piano, I/E+D/N |
| 11 | MMSX: quantità zero/assente/uno, con/senza eventi, intervalli singoli o multipli |
| 12 | Evento ordinario `none`, colore e destinatario elemento |
| 13 | Perdite colori dichiarate: approssimazione MMSX / override individuale non rappresentabile in MSD |
| 14 | Quattro eventi di sistema su date distinte, più evento ordinario non convertibile in MSD |
| 15 | Quattro definizioni Red Flag MSD riservate, senza entry: verificarne creazione dalla UI nativa |
| 16 | MSD: uno stesso attore con quantità 1 e 3; varianti, Board ID, collegamenti e Red Flags aggiornati |

Varianti nuove: MSD EPSF `04.00.000` / MMB10, 11 sezioni; MMS2 `dataFormat:5`
con estensione `.mmsx`. Studio v3 / modello comune v3.

## Aspettative da verificare con attenzione

- MMSX: nessuna quantità risorsa è `{}`. L'assenza e i vecchi zeri diventano 1;
  l'elemento singolo resta associato alla scena. Non deve apparire selezionato ma invisibile nel box. Daily Category
  Total deve restare numerico, senza `[object…]`. Studio mantiene gli originali.
- MSD: le quantità esplicite sono leggibili nei nomi, ad esempio `Oggetto a quantità zero`, `Èlia` e `Tazzina blu (3)`. Sono testo, non quantità native.
  Il sistema dal nome legge numeri iniziali o suffissi numerici tra parentesi; il sistema per scena resta selezionabile.
- Ogni stripboard MSD contiene tutte le scene esattamente una volta. Nei casi
  04/07/09 il complemento del segmento va in coda al suo Boneyard, dopo il contenuto
  esistente, senza date. In MMSX i segmenti continuano a ripartire le scene.
- Le quattro definizioni Travel - DOOD, Fitting - DOOD, Unavailable e
  Rehearsal - DOOD devono esistere in ogni MSD, anche nei minimi senza entry.
- Nel caso 14: Travel 6 ottobre 2026, Fitting 7, Rehearsal 9, Unavailable 10;
  evento ordinario 11. In MSD i primi quattro diventano Red Flags per ciascun
  elemento/variante; l'ordinario è omesso. Nel DOOD verificare TR / FT / R
  scegliendo anche l'intervallo 6–11 ottobre. I tipi non si sovrappongono tra loro.
- Rehearsal usa il nome riservato e DOODStatus 0, presente nel campione generale
  ricevuto. L'utente ha confermato il trasferimento corretto del caso 14 v5 in MMS6;
  i nuovi file v6 restano da verificare.
- La portata calendario/segmento degli eventi può diventare globale in MSD;
  manifest e dialogo la dichiarano. Testi e note restano nelle Red Flags derivate.
- Boneyard non programmato: eventuali metadati calendar del segmento MMSX non
  attribuiscono date alle sue strip.

## Checklist per ogni file

- [ ] Registrare file e hash, applicazione, **versione completa/build**, sistema,
      data e tester nel CSV; aggiungere righe per prove su versioni diverse.
- [ ] Aprire MSD in MMS6 / MMSX in MMS10 senza riparazioni o errori; riportare
      testualmente avvisi, crash o conversioni automatiche.
- [ ] Confrontare scene, campi, accenti, categorie, elementi e proprietà con
      `expected` nel manifest. Controllare quantità assenti/zero/positive secondo
      le trasformazioni specifiche, non secondo le vecchie aspettative v4.
- [ ] Verificare riferimenti delle scene, varianti dei nomi, collegamenti e target
      delle flag; nessun elemento duplicato ambiguo o relazione sospesa.
- [ ] Confrontare ogni piano, segmento e Boneyard: scene presenti, ordine di strip
      e banner, giornate, numeri, date, calendari, festività ed eccezioni lavorative.
- [ ] Aprire breakdown, palette colori, Daily Category Total, Red Flags e DOOD.
      Confrontare pagina di editing Red Flags e report Red Flags separatamente.
- [ ] In MMS10 aprire anche One-line Vertical e Calendar Report; verificare
      eventi visibili e cliccabili e l'assenza di crash.
- [ ] In MMS6 verificare presenza delle quattro definizioni nel caso 15,
      creazione di nuove flag, sigle DOOD e conversioni del caso 14.
- [ ] Confrontare ogni omissione e trasformazione del manifest col contenuto
      effettivo. RGB fuori palette e geometrie proprietarie hanno limiti dichiarati.
- [ ] Salvare con un NUOVO nome in Movie Magic, chiudere, riaprire e ripetere
      controlli su relazioni, ordine, quantità nei nomi, colori, date e sigle.
- [ ] Per 05–07 aprire anche Studio, verificare dati integrali e riesportare.

## Registro

`manual-results.csv` ha una riga per export, inizialmente DA ESEGUIRE. Usare PASS,
FAIL o PARZIALE soltanto dopo la prova; allegare nel campo anomalie riferimenti
alle schermate e alla copia risalvata. Le prove automatiche non compilano esiti
MMS6/MMS10. Dettagli tecnici e incognite: `FORMAT-NOTES.md` nel pacchetto.

| App | Versione/build | OS | File/hash | Apertura | Relazioni / ordine / date | Quantità / colori / DOOD | Salva e riapri | Anomalie |
|---|---|---|---|---|---|---|---|---|
| MMS6 | da registrare | da registrare | ogni MSD | DA ESEGUIRE | DA ESEGUIRE | DA ESEGUIRE | DA ESEGUIRE | |
| MMS10 | da registrare | da registrare | ogni MMSX | DA ESEGUIRE | DA ESEGUIRE | DA ESEGUIRE | DA ESEGUIRE | |


V6: dal dialogo scegliere il sistema di quantità e, per MSD, nome con suffisso
oppure numero iniziale. Non sono aggiunti (0) o (1). I Board ID delle varianti
sono non vuoti e unici nella categoria. Il caso 17 usa quantità dal nome, il 18
il prefisso numerico. Il totale giornaliero Studio usa il massimo per elemento.
La nota FORMAT-NOTES.md della v6 sostituisce le aspettative storiche sui vecchi zeri.
