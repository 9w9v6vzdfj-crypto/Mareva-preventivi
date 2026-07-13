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

- **Pagamenti (Stripe)** — il codice è pronto e SPENTO: si attiva compilando
  `STRIPE_PREZZI` in `app.js`. Modello scelto: gratis fino a 3 preventivi
  (sopralluoghi illimitati), poi abbonamento mensile o annuale. Passi:
  1. ⬜ **Firebase → piano Blaze** (pay-as-you-go; ai tuoi volumi ~0€,
     imposta un budget alert).
  2. ⬜ **Firebase Console → Extensions → "Run Payments with Stripe"**:
     installala incollando una **chiave API ristretta** di Stripe (creata in
     sandbox dal dashboard Stripe). ⚠️ Le chiavi segrete NON vanno mai
     condivise in chat: si incollano solo lì.
  3. ⬜ **Stripe (sandbox) → Prodotti**: crea "Facile Preventivo" con due
     prezzi ricorrenti — **2,99 €/mese** e **29,99 €/anno** (cifre decise:
     devono combaciare con quelle mostrate nel paywall dell'app). Copia i
     due **price ID** (`price_…`, non sono segreti) e passali a Claude:
     verranno inseriti in `STRIPE_PREZZI` e il paywall si accende.
  4. ⬜ **Ri-pubblica `firestore.rules`** (aggiornate con le collezioni
     dell'estensione E con il requisito email verificata). Nota: fallo DOPO
     aver confermato la tua email nell'app, altrimenti la sync del tuo
     account resta bloccata finché non la confermi.
  5. ⬜ Test in sandbox con carta di prova `4242 4242 4242 4242`, poi
     passaggio alle chiavi live per incassare davvero.
- **Legale (GDPR)** — ✅ bozze pubblicate: `privacy.html` e `termini.html`,
  intestate a MOI DOM di Lyakhu Liya (P.IVA 13001710964, PEC), linkate dal
  cancello d'accesso e da Impostazioni → Informazioni legali.
  - Indirizzo della sede: **per scelta non esposto** (il domicilio fiscale
    coincide con l'abitazione); P.IVA + PEC identificano e rendono
    contattabile il titolare. Da riconsiderare col professionista se serve.
  - Da fare: **far revisionare i testi a un professionista** prima di
    incassare; fatturazione degli incassi: commercialista.

## Note tecniche sulla sync (per riferimento)

- Locale-first: il telefono resta la fonte primaria; il cloud è uno specchio
  per-utente (`users/{uid}/app/dati`).
- Fusione senza perdite: i documenti si uniscono per id e vince la modifica
  più recente; le eliminazioni sono ricordate (tombstone) e non "risorgono".
- Il primo login con dati locali esistenti li carica sul cloud (migrazione
  automatica).
