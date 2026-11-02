# Candidati diagnostici dal caso sintetico risalvato in MMS10

Questi due file non sono certificati da MMS10. Parser e confronti automatici:
PASS; apertura, report e salvataggio/riapertura MMS10: **DA ESEGUIRE**.

- `actor-0`: conserva la quantità zero originale di Èlia nella prima scena.
- `actor-1`: SOLO controllo diagnostico, cambia quella quantità da zero a uno.

Entrambi mantengono scene, intervallo Red Flag e i tre eventi nei rispettivi
segmenti; l'evento aggiunto dall'utente resta `type: none` e il vecchio fitting
resta fitting. Ogni evento ha colore e ID di record distinto. Sono ricostruiti
esplicitamente dal modello corrente con nuovi layout sintetici. Il manifest
elenca trasformazioni e omissioni, inclusi i due destinatari progetto degli
eventi non verificati e i dati opachi non ricostruiti. I target elemento restano.
I colori già bianchi nel file ricevuto restano bianchi: per recuperarli occorre
il progetto Studio o il sorgente che li contiene ancora.

Provare prima `actor-0`, poi `actor-1`: evento visibile e cliccabile, fitting FT
nel DOOD, pagina Red Flags, report Red Flags, One-line Vertical e Calendar Report.
Registrare separatamente ogni risultato, build esatta, OS e successivo salvataggio
con riapertura. Non sovrascrivere gli originali.

Riproduzione dal repository:

```sh
MMSX_EDIT_SAMPLE='/percorso/02-new-complex_edit.mmsx' node tests/generate-user-candidates.js
```

Il generatore deve essere usato solo su questo caso sintetico: non distribuisce
l'archivio originale, né i percorsi locali del file risalvato. Seed fisso 314159.
