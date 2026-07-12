# DA FARE — stato e prossimi passi

## ✅ Fatto

- **Regole Firestore pubblicate** (verificato): ogni utente legge/scrive solo
  i propri dati; la **sincronizzazione cloud è attiva**. Nel menu account
  (in alto a destra) lo stato deve dire "☁️ Sincronizzato · HH:MM".
- **Login Google: rinunciato per scelta** — il bottone è stato rimosso dal
  cancello d'accesso. Email/password + recupero password coprono tutto.

## Per riattivare il login Google (solo se un giorno servirà)

1. Firebase Console → **Authentication** → **Sign-in method** → abilita
   **Google** (interruttore "Attiva" + email di assistenza + Salva).
2. **Authentication → Settings → Authorized domains** → aggiungi il dominio
   GitHub Pages del sito (es. `TUOACCOUNT.github.io`).
3. Ripristina il bottone in `index.html` (è lì, commentato, con le istruzioni).

## Per la vendita

- **Pagamenti (Stripe)** — ⬜ unico passo tecnico rimasto: apri un account su
  stripe.com con i dati della tua attività. Con le chiavi API si integra il
  checkout/abbonamento e le regole Firestore verificheranno lo stato
  "abbonato" lato server.
- **Legale (GDPR)** — ✅ bozze pubblicate: `privacy.html` e `termini.html`,
  intestate a MOI DOM di Lyakhu Liya (P.IVA 13001710964, PEC), linkate dal
  cancello d'accesso e da Impostazioni → Informazioni legali. Da completare:
  1. aggiungere l'**indirizzo della sede** nel riquadro del titolare di
     entrambe le pagine;
  2. **far revisionare i testi a un professionista** prima di incassare;
  3. fatturazione degli incassi: commercialista.

## Note tecniche sulla sync (per riferimento)

- Locale-first: il telefono resta la fonte primaria; il cloud è uno specchio
  per-utente (`users/{uid}/app/dati`).
- Fusione senza perdite: i documenti si uniscono per id e vince la modifica
  più recente; le eliminazioni sono ricordate (tombstone) e non "risorgono".
- Il primo login con dati locali esistenti li carica sul cloud (migrazione
  automatica).
