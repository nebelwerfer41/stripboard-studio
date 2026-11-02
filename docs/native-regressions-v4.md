> Revisione corrente: [v5 — quantità, piani MSD completi e Red Flags](native-regressions-v5.md). Questa pagina contiene anche risultati storici.

# Revisione v4: riscontri MMS6/MMS10 e limiti ancora aperti

Il riscontro della suite v3 è in `verification/manual-feedback-v3.json`, con
hash dei file effettivamente consegnati. Lo ZIP v3 è conservato. Le build esatte
MMS6/MMS10 restano da registrare. Nessuna riapertura nativa è stata eseguita in
questo ambiente; le modifiche seguenti sono verificate con i parser e con il
confronto delle strutture, non con l'esecuzione dei report Movie Magic.

## Evidenze e correzioni

| Problema segnalato | Evidenza nei file | Modifica e stato |
|---|---|---|
| Strip bianche in entrambi i formati | Il vecchio adattatore MSD generava una palette grigia e celle bianche. In MMSX non ricostruiva `contents.rules` e usava colori predefiniti delle schede. | MSD scrive la griglia RGB e i 32 slot; MMSX scrive regole con riferimenti I/E–D/N e colori delle singole schede. Verificati import, modifica, Studio e reimport; resa MMS6/MMS10 da verificare. |
| Palette MMSX persa dopo modifica completa | Il parser esponeva i colori delle scene ma non le regole delle combinazioni inutilizzate. | Regole, etichette e colori sono nel modello comune. Migrazioni v2/v3 recuperano le regole dal sorgente preservato se lo snapshot non contiene una griglia modificata. |
| MSD Day/Night vuoto | La suite scriveva `DAY`, mentre la riga della griglia è `Day`. Nel riferimento MSD I/E e D/N non sono categorie di risorse. | Il writer allinea il valore all'etichetta della griglia; i due campi sono scalari e palette, non elementi MSD. Test automatici sul contenuto XML; riconoscimento MMS6 da verificare. |
| Evento invisibile ma cliccabile | Nel file risalvato il nuovo evento ha `color: "#10457A"`, `type: "none"` e target Èlia. Il vecchio evento non ha colore. La suite copiava inoltre lo stesso ID evento in due calendari. | Colore esplicito e ID distinti per record/segmento. `none` rimane un evento ordinario, senza codice DOOD inventato; `fitting` resta distinto. Visibilità MMS10 da verificare. |
| Crash One-line Vertical | Il riferimento ha una geometria verticale propria, con cella protetta `CAST`, `timeOfDay` e celle numeriche strette. La suite clonava il layout orizzontale. | Layout verticale specifico e test della struttura. La differenza è accertata; che risolva il crash va verificato in MMS10. |
| Una scena in due sub-board dello stesso piano | La fixture e il generatore duplicavano il riferimento alla stessa scheda. Il comportamento di riaggancio è stato riprodotto dall'utente in MMS10. | Invariante: una sola collocazione per scena all'interno di un piano padre, tra segmenti normali e Boneyard. Validazione dei comandi e blocco export anche nel percorso nativo. Piani padri alternativi possono condividere la scena. I casi 04/07/08/09 ora ripartiscono scene diverse tra segmenti. |

Un documento Studio può conservare un vecchio progetto con collocazioni invalide
per permetterne la correzione senza cancellazioni silenziose. I comandi possono
ridurre gradualmente i conflitti preesistenti, ma non aggiungerne; l’export
richiede comunque che siano tutti risolti. L'export MMSX lo
blocca indicando scena e posizioni. Non si eliminano automaticamente istanze
né si clonano schede per mascherare una duplicazione.

I Boneyard restano non programmati: i metadati `calendar` del segmento presenti
nei riferimenti non assegnano `date` o `shootDay` alle strip. La revisione v4
mantiene la correzione già documentata nella revisione v3.

## Red Flags: causa non ancora dimostrata

Il layout `redFlags` del riferimento e quello della suite hanno la stessa
struttura minimale. Il file risalvato mantiene il vincolo Èlia 6–8 ottobre,
ma non aggiunge campi che spieghino direttamente **NO RED FLAGS** nel report.
Il riscontro distingue correttamente la pagina di editing dal report.

Le conversioni tramite MSD che funzionano (03/06) differiscono per due aspetti:
non hanno quantità numeriche e hanno una entry Red Flag per singola data,
mentre MMSX conserva l'intervallo. Non sappiamo ancora quale differenza sia
rilevante per il consumer. Non si converte quindi zero in uno né si spezza
silenziosamente un intervallo MMSX.

Nella nuova fixture principale Èlia ha quantità uno, mentre un altro oggetto
ha quantità zero e Tazzina ha quantità assente: è una scelta esplicita del nuovo
caso sintetico, non una migrazione dei dati utente. I controlli `11-*` isolano
quantità zero/assente/uno, presenza di eventi e date singole/intervalli. Il caso
`12-*` usa un evento ordinario `none`, come quello aggiunto dall'utente.

## Capacità colori ed eventi dichiarate prima dell'export

- Studio conserva integralmente griglia, regole native, colori per scena e
  archivio originale. Un colore già sostituito da bianco nel vecchio export non
  è recuperabile dal solo file risalvato: non se ne inventa il valore.
- MMSX ricostruito usa i token `color0`–`color78` osservati nel codice della
  palette. Un RGB non presente viene approssimato al token più vicino, con
  quantità di celle/scene coinvolte nel rapporto da confermare. Il contenuto
  reimportato viene confrontato con questo valore. Le celle senza coppia di etichette o Other non hanno una regola MMSX
  verificata: sono dichiarate omesse, mantenendo i colori delle singole scene.
  La codifica di colori personalizzati delle strip nel consumer rimane un'incognita.
- Le preferenze globali di selezione/banner/fine giornata non hanno una codifica
  MMSX ricostruita verificata; sono dichiarate omesse. Lo stesso vale per stili
  individuali dei banner nei due formati, distinti dai colori delle scene.
- MSD ricostruito conserva RGB della griglia e della palette. Colori individuali
  diversi per scene della stessa combinazione non hanno una rappresentazione
  verificata: prevale la griglia e il rapporto elenca le scene coinvolte.
- Il destinatario globale senza nome è osservato per le Red Flags, ma non è
  verificato per gli eventi. Nella ricostruzione MMSX si mantengono i target
  elemento; i target progetto e gli eventi senza target elemento sono omessi
  con conferma esplicita. Non si perde l'originale nel salvataggio Studio.
- Il percorso nativo invariato continua a conservare i byte, anche quando il
  contenitore proviene da una vecchia suite. La ricostruzione forzata usata per
  i candidati di diagnosi è esplicita e ha il proprio rapporto delle perdite.

## File e verifiche

`verification/movie-magic-suite-v4.zip` contiene la nuova suite sintetica,
manifest con hash/contenuto/perdite, checklist e CSV inizialmente da compilare.
Il generatore ha seed fisso; non usa contenuto dei riferimenti privati.
`13-color-losses` verifica che approssimazioni MMSX e override omessi MSD siano
coerenti con quanto reimportato.

`verification/user-candidates-v4` contiene due ricostruzioni del caso sintetico
`02-new-complex_edit.mmsx`. `actor-0` conserva lo zero ricevuto; `actor-1` cambia
soltanto quella quantità come controllo diagnostico. Entrambe conservano i tre
eventi, compreso quello aggiunto in MMS10, i relativi tipi, date e target elemento.
Le perdite della ricostruzione sono elencate nel manifest. I colori già bianchi
nel file ricevuto restano tali. Non sono sostituti del progetto Studio completo.

Test automatici pertinenti: `native-regressions-v4.mjs`, `native-color-samples.mjs`
(con riferimenti locali opzionali), suite Node, workflow browser e generatore.
Sulle 146 scene del riferimento MMSX il confronto conferma tutti i colori delle
scene e tutte le 12 regole dopo modifica completa e passaggio Studio; il nativo
invariato resta identico. Il confronto della coppia MSD/MMSX continua a verificare
i 146 tempi stimati. Queste prove non attribuiscono alcun PASS all'importazione
manuale, ai report o al salvataggio successivo in Movie Magic.
