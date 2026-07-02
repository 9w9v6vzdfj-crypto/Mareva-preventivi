# DA FARE — passi che richiedono l'accesso a Firebase Console

Il codice della sincronizzazione cloud è già pubblicato e **si attiva da solo**
appena completi i punti 1 e 2 (5 minuti in tutto). Fino ad allora l'app
continua a funzionare in locale come sempre; nel menu account (in alto a
destra) vedi lo stato: "⚠️ Cloud non attivo" → "☁️ Sincronizzato".

## 1. Pubblica le regole Firestore (obbligatorio per la sync)

1. Apri [Firebase Console](https://console.firebase.google.com) → progetto **facile-preventivo**.
2. Menu a sinistra: **Firestore Database** → scheda **Regole** (Rules).
3. Cancella il contenuto e incolla il testo del file [`firestore.rules`](firestore.rules) di questo repository.
4. Premi **Pubblica**.

Le regole dicono: ogni utente autenticato legge/scrive solo `users/{suo uid}/…`.
Nessuno può vedere i dati degli altri.

## 2. Autorizza il dominio del sito (ripara "Accedi con Google")

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**.
2. **Add domain** → aggiungi il dominio da cui è servita l'app
   (il dominio GitHub Pages, es. `TUOACCOUNT.github.io`).

Senza questo, il bottone "Accedi con Google" fallisce con
*unauthorized-domain* (email e password funzionano comunque).

## 3. Verifica (1 minuto)

1. Apri l'app, accedi, tocca il menu in alto a destra: deve dire
   **"☁️ Sincronizzato · HH:MM"** (se dice "Cloud non attivo", tocca
   "🔄 Sincronizza ora" dopo aver pubblicato le regole).
2. Accedi con lo stesso account da un secondo dispositivo/browser:
   i preventivi devono comparire.

## Più avanti — per la vendita (non urgente)

- **Pagamenti**: Stripe per abbonamento web (o acquisti in-app se si va
  sugli store). Le regole Firestore potranno verificare lo stato
  dell'abbonamento, così il "paga per usare" è imposto dal server.
- **Legale (GDPR)**: privacy policy (si raccolgono email; Firebase/Google è
  responsabile del trattamento), termini di servizio, recesso digitale,
  P.IVA/fatturazione. Da far revisionare a un professionista.

## Note tecniche sulla sync (per riferimento)

- Locale-first: il telefono resta la fonte primaria; il cloud è uno specchio
  per-utente (`users/{uid}/app/dati`).
- Fusione senza perdite: i documenti si uniscono per id e vince la modifica
  più recente; le eliminazioni sono ricordate (tombstone) e non "risorgono".
- Il primo login con dati locali esistenti li carica sul cloud (migrazione
  automatica).
