# Facile Preventivo

PWA per imprese edili e artigiani per fare **preventivi** dal telefono, in
quattro passi sempre uguali: **Locali → Misure → Lavori → Preventivo**, poi un
PDF stampabile con l'intestazione dell'impresa. Archivio con stati (bozza /
inviato / accettato / rifiutato) e duplicazione per lavori simili.

Un locale, una scheda: al passo Misure si scrivono lunghezza, larghezza e
altezza; al passo Lavori si spuntano le lavorazioni e **le quantità arrivano da
sole dalle misure** (m² di pareti, soffitto o pavimento). Nella scheda lavori:

- **lavori più usati** (demolizioni, massetto, pavimenti, intonaco,
  tinteggiature, controsoffitto, smaltimento) con prezzo al m²; l'ultimo prezzo
  usato viene ricordato nel *listino* e proposto nei preventivi successivi;
- **impianti** elettrico e idraulico come voce a corpo, con dettagli facoltativi;
- **infissi** col disegno tecnico in prospetto (funzione pura `disegnoInfisso`:
  "V" tratteggiata col vertice sul lato cerniere, vasistas, anta-ribalta,
  scorrevole, fissa, quote in mm); la loro superficie è tolta dalle pareti;
- **lavorazioni scritte a mano** (quantità, unità, prezzo) e **note** del locale.

"Copia su tutti i locali" ripete lavori e impianti in ogni stanza. In arrivo:
partire da una **pianta disegnata col dito** al posto dell'elenco dei locali.

I preventivi della versione precedente (a mestieri) restano in archivio ma non
si aprono più: si possono solo eliminare.

## Com'è fatta

Vanilla HTML/CSS/JS, **nessun build step**: si pubblica così com'è (es. GitHub
Pages).

| File | Ruolo |
|---|---|
| `index.html` | Struttura delle pagine (home, preventivo, archivio, impresa) |
| `app.js` | Auth, store, sync cloud, archivio, backup, abbonamento, guida, stampa PDF |
| `preventivo.js` | Il preventivo a passi: modello dati, calcoli, schede dei locali, PDF |
| `style.css` | Stili |
| `sw.js` | Service worker (offline + aggiornamenti) |
| `manifest.json`, `icon-*.png` | Installazione PWA |
| `test-app.js` | Test automatici (vedi sotto) |

Punti chiave:

- **`Store`** è l'unico punto di accesso ai dati (oggi `localStorage`); per il
  futuro passaggio al cloud basta cambiare lì dentro.
- **Calcoli puri** in `preventivo.js` (`locSup`, `locRighe`, `docTotali`,
  `buildPdfPrev`): usati da editor, PDF e test.
- **`esc()` / `escJs()`**: escape HTML per ogni dato utente interpolato nei
  template; `escJs` per i valori dentro gli handler `onclick`/`onchange`.

## Dati e privacy

L'app è **locale-first**: i dati vivono nel `localStorage` del dispositivo e
tutto funziona anche offline. Con il login, i dati si **sincronizzano sul
cloud** (Firestore, `users/{uid}/app/dati`) come specchio per-utente: fusione
per id senza perdite, eliminazioni ricordate con tombstone, migrazione
automatica dei dati locali al primo login. La sync richiede le regole di
`firestore.rules` pubblicate (vedi `DA-FARE.md`); finché non lo sono, l'app
resta locale e lo stato è visibile nel menu account. I dati locali sono
**isolati per account** (`mv_uid`): se sullo stesso dispositivo accede un
account diverso, i dati del precedente vengono messi da parte
(`mv_saved_<uid>`) e ripristinati al suo ritorno. Backup manuale:
esporta/ripristina JSON dalla pagina Impostazioni.

## Test

```bash
node test-app.js
```

Regola: **non si rilascia se non è tutto verde**. Il workflow GitHub Actions
(`.github/workflows/test.yml`) esegue la suite su ogni push e pull request.

- I test caricano `app.js` + `preventivo.js` in una sandbox (`node:vm`) con
  stub del DOM: avvio con memoria vuota/corrotta/vecchio formato, calcoli
  (superfici, infissi, totali), contenuti e determinismo del PDF, escape HTML,
  salvataggio e listino, backup, sync, guida, abbonamento, isolamento account.

## Rilascio

1. Test tutti verdi (`node test-app.js`).
2. Bumpa `CACHE` in `sw.js` (es. `facile-preventivo-v14` → `v15`): è il
   cache-busting che fa arrivare la nuova versione agli utenti.
3. Pubblica i file statici.
