# Facile Preventivo

PWA per imprese edili e artigiani per fare **preventivi** dal telefono.
All'apertura ci sono solo due scelte: **Disegna la pianta** o **Senza disegno**;
in basso **Preventivi** (bozze e preventivi fatti, filtrati per stato) e
**Impresa**. Il flusso ha
tre passi sempre uguali: **Locali (o Pianta) con le misure → Lavori →
Preventivo**, poi un PDF con l'intestazione dell'impresa, da stampare o inviare
(📤 Invia: PDF vero condiviso dal telefono). Archivio con stati (bozza /
inviato / accettato / rifiutato) e duplicazione per lavori simili.

Le misure si scrivono al primo passo (in riga, o toccando la stanza sulla
pianta) e sono facoltative. Al passo Lavori, in cima, i lavori **"in tutti i
locali"** (una spunta vale per ogni stanza); le stanze mostrano solo extra ed
eccezioni, e **le quantità arrivano da sole dalle misure** (m² di pareti,
soffitto o pavimento; senza misure il lavoro si prezza **a corpo**). In fondo
le **voci per tutto il cantiere** (smaltimento macerie, pulizia, ponteggio,
pratiche…). Nella scheda del locale:

- **lavori più usati** (demolizioni, massetto, pavimenti, intonaco,
  tinteggiature, controsoffitto) con prezzo al m²; i prezzi stanno nel
  *listino* dell'impresa (chiesto una volta, modificabile da Impresa);
- **impianti** elettrico e idraulico come voce a corpo, con dettagli facoltativi;
- **infissi** col disegno tecnico in prospetto (funzione pura `disegnoInfisso`:
  "V" tratteggiata col vertice sul lato cerniere, vasistas, anta-ribalta,
  scorrevole, fissa, quote in mm); la loro superficie è tolta dalle pareti;
- **lavorazioni scritte a mano** (quantità, unità, prezzo) e **note** del locale.

Si può partire **disegnando la pianta col dito** (`pianta.js`, foglio a tutto
schermo): le linee storte vengono raddrizzate e agganciate, ogni stanza chiusa
diventa un locale del preventivo; si tocca una stanza per nome e misure, un
muro per la sua misura (che aiuta la messa in scala e compila da sola le
misure delle stanze rettangolari), per porte e finestre (tolte dalle pareti di entrambi i lati; entrano nei
lavori solo se gli si dà un prezzo). Quando tutte le stanze hanno le misure la
pianta **si mette in scala da sola** (minimi quadrati sulle linee della
pianta). C'è anche la vista 3D (Three.js da CDN, caricato solo se serve). La
pianta 2D compare nei passi Misure e Lavori e in testa al PDF.

La pianta si può aggiungere dopo (le stanze si collegano ai locali già
scritti) o togliere (i locali restano). "Usa come modello" riparte da un
preventivo esistente con un cliente nuovo. I preventivi della versione
precedente (a mestieri) non si aprono più: in Archivio si eliminano in blocco.

## Com'è fatta

Vanilla HTML/CSS/JS, **nessun build step**: si pubblica così com'è (es. GitHub
Pages).

| File | Ruolo |
|---|---|
| `index.html` | Struttura delle pagine (nuovo/preventivo, preventivi, impresa) |
| `app.js` | Auth, store, sync cloud, archivio, backup, abbonamento, guida, stampa PDF |
| `preventivo.js` | Il preventivo a passi: modello dati, calcoli, schede dei locali, pianta 2D, PDF |
| `pianta.js` | Il foglio di disegno: riconoscimento stanze, misure, porte/finestre, messa in scala, 3D |
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

- I test caricano `app.js` + `preventivo.js` + `pianta.js` in una sandbox (`node:vm`) con
  stub del DOM: avvio con memoria vuota/corrotta/vecchio formato, calcoli
  (superfici, infissi, totali), contenuti e determinismo del PDF, escape HTML,
  salvataggio e listino, backup, sync, guida, abbonamento, isolamento account,
  pianta senza schermo (stanze→locali, porte, messa in scala, PDF).

## Rilascio

1. Test tutti verdi (`node test-app.js`).
2. Bumpa `CACHE` in `sw.js` e il `?v=` di script e CSS in `index.html` (es. `facile-preventivo-v14` → `v15`): è il
   cache-busting che fa arrivare la nuova versione agli utenti.
3. Pubblica i file statici.
