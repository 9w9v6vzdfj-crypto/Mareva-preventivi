# Facile Preventivo

PWA per artigiani (imbianchino, muratore, elettricista, idraulico,
serramentista e mestiere libero) per gestire **sopralluoghi** e **preventivi**
dal telefono: rilievo degli ambienti, lavorazioni con prezzi (e quantità per i
mestieri tecnici), sconto/IVA, PDF stampabile con intestazione dell'impresa,
archivio con stati (bozza / inviato / accettato / rifiutato) e duplicazione
dei preventivi per lavori simili.

Il **muratore** può lavorare da impresa generale: nel documento si attivano i
"moduli" degli altri mestieri (imbiancatura, elettrico, idraulico, serramenti)
e le loro voci si aggiungono agli elenchi dei locali mantenendo le regole del
mestiere d'origine (quantità × prezzo per le voci tecniche, sezione serramenti
col disegno). Ogni voce importata ricorda la sua categoria (`loc.lavoriCat`) e
il PDF mostra il **riepilogo per categoria** con i subtotali.

Per il **serramentista** l'app genera il disegno tecnico in prospetto di
finestre e porte (SVG, funzione pura `disegnoSerramento`): tipo, misure in mm,
numero di ante e apertura per anta (battente dx/sx, vasistas, anta-ribalta,
scorrevole, fissa), con la convenzione professionale — "V" tratteggiata col
vertice sul lato cerniere, vasistas col vertice in basso, freccia per gli
scorrevoli — e le quote. Il disegno compare nella card del locale e nei PDF
di sopralluogo e preventivo.

## Com'è fatta

Vanilla HTML/CSS/JS, **nessun build step**: si pubblica così com'è (es. GitHub
Pages).

| File | Ruolo |
|---|---|
| `index.html` | Struttura delle pagine (dashboard, sopralluogo, preventivo, archivio, impostazioni) |
| `app.js` | Tutta la logica: auth, store, mestieri, form, calcoli, PDF, backup |
| `style.css` | Stili |
| `sw.js` | Service worker (offline + aggiornamenti) |
| `manifest.json`, `icon-*.png` | Installazione PWA |
| `test-app.js`, `harness.js` | Test automatici (vedi sotto) |

Punti chiave di `app.js`:

- **`Store`** è l'unico punto di accesso ai dati (oggi `localStorage`); per il
  futuro passaggio al cloud basta cambiare lì dentro.
- **`MESTIERI`** è la configurazione che guida UI e PDF (superficie, quantità,
  modalità lavori): niente `if mestiere === ...` sparsi.
- **`esc()` / `escJs()`**: escape HTML per ogni dato utente interpolato nei
  template; `escJs` per i valori dentro gli handler `onclick`/`onchange`.

## Dati e privacy

L'app è **locale-first**: i dati vivono nel `localStorage` del dispositivo e
tutto funziona anche offline. Con il login, i dati si **sincronizzano sul
cloud** (Firestore, `users/{uid}/app/dati`) come specchio per-utente: fusione
per id senza perdite, eliminazioni ricordate con tombstone, migrazione
automatica dei dati locali al primo login. La sync richiede le regole di
`firestore.rules` pubblicate (vedi `DA-FARE.md`); finché non lo sono, l'app
resta locale e lo stato è visibile nel menu account. Backup manuale:
esporta/ripristina JSON dalla pagina Impostazioni.

## Test

```bash
node test-app.js
```

Regola: **non si rilascia se non è tutto verde**. Il workflow GitHub Actions
(`.github/workflows/test.yml`) esegue la suite su ogni push e pull request.

- I test caricano `app.js` in una sandbox (`node:vm`) con stub del DOM:
  avvio con memoria vuota/corrotta, roundtrip del backup, escape HTML.
- `harness.js` genera i PDF di preventivo e sopralluogo su dati campione
  deterministici e ne calcola gli hash: i PDF di **imbianchino** e
  **muratore** devono restare identici al bit (baseline in `test-app.js`).
  Se un giorno cambi volutamente quei PDF, aggiorna i valori in `BASELINE`.

## Rilascio

1. Test tutti verdi (`node test-app.js`).
2. Bumpa `CACHE` in `sw.js` (es. `facile-preventivo-v14` → `v15`): è il
   cache-busting che fa arrivare la nuova versione agli utenti.
3. Pubblica i file statici.
