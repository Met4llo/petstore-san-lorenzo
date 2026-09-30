# Pet Store San Lorenzo — copia di sviluppo separata

App dedicata a San Lorenzo, basata sul catalogo di `Met4llo/petstore-scadenze` al commit `2fd0223282436dfa1fff7627bb0799dde759de24`. Nessun file del progetto originale, tabella o dato di La Malfa viene modificato. Catalogo: 14.916 prodotti; stessi fornitori, accessori e condizioni. La copia del catalogo è una fotografia: gli aggiornamenti futuri vanno distribuiti a entrambe le app.

## Accesso

L'operatore seleziona il nome e inserisce la password. La password viene verificata da Supabase Auth, non confrontata con valori nel browser. Nomi: Sepi (responsabile), Liborio, Daniela, Francesco. I nomi vengono associati ad alias email tecnici; gli operatori non devono conoscere o digitare questi alias. Non hanno una casella email né un recupero via email: il ripristino si gestisce con l'amministrazione Supabase. Nessuna password predefinita o salvata dalla nostra app.

Un ingresso separato «Accesso amministratore» accetta email e password del progettista. Il suo nome non compare tra i quattro operatori; le sue modifiche sono registrate come «Amministratore». Il responsabile può gestire i dati del negozio come gli altri operatori; non può creare account o assegnare ruoli dal browser.

La selezione del nome non concede permessi. Il database riconosce `auth.uid()` e il profilo privato. Profili e ruoli possono essere creati solo da un amministratore sul backend. Non viene letta la chiave locale `petstore_operator` dell'app precedente. Gli account non autorizzati e gli utenti anonimi non possono leggere dati del negozio.

## Attivazione: richiede un nuovo progetto Supabase

1. Creare un progetto Supabase nuovo, diverso da `olfltcygpakierjzrhcr`. Non eseguire SQL nel progetto di La Malfa. Il frontend e lo script rifiutano espressamente l'URL di La Malfa.
2. Nel nuovo progetto, eseguire `database/setup.sql`. Lo script crea solo tabelle `sl_*` e funzioni di questa nuova app. È uno script iniziale da eseguire una sola volta, non una migrazione da ripetere.
3. In Authentication disabilitare le nuove registrazioni pubbliche e i login anonimi. Abilitare il provider email/password; configurare una password minima di 12 caratteri e i limiti di frequenza disponibili. Configurare le URL del nuovo sito. Non serve disabilitare la verifica email: lo script amministrativo crea account già confermati.
4. Creare i cinque account con `scripts/create-accounts.mjs` oppure dal pannello Supabase. L'associazione nella tabella `sl_profiles` è indispensabile. Alias: `sepi@san-lorenzo.petstore.invalid`, `liborio@san-lorenzo.petstore.invalid`, `daniela@san-lorenzo.petstore.invalid`, `francesco@san-lorenzo.petstore.invalid`. Ruoli e nomi esatti sono nel SQL. Per il progettista usare la sua email e `display_name='Amministratore', role='admin'`.
5. Per lo script, impostare in un terminale privato le variabili `SL_SUPABASE_URL`, `SL_SERVICE_ROLE_KEY`, `SL_ADMIN_EMAIL`, `SL_PASSWORD_SEPI`, `SL_PASSWORD_LIBORIO`, `SL_PASSWORD_DANIELA`, `SL_PASSWORD_FRANCESCO`, `SL_PASSWORD_ADMIN`, quindi eseguire `node scripts/create-accounts.mjs`. Usare password diverse di almeno 12 caratteri. Non incollare segreti in chat, nei commit o in `config.js`. Lo script non stampa password o chiavi. Non ripeterlo alla cieca dopo un errore: controllare gli account già creati.
6. Inserire SOLO URL nuovo e chiave pubblicabile/anon in `config.js`. Nessuna chiave segreta o service_role nel frontend.
7. Servire questa directory su un sito HTTPS separato. La fotocamera richiede HTTPS (localhost va bene per sviluppo). Non sostituire la pubblicazione di La Malfa e non caricare questa cartella sul suo percorso in produzione. Per sviluppo: `python -m http.server 8080 --directory /workspace/san-lorenzo`.
8. Eseguire le verifiche manuali sotto prima di consegnare gli account.

## Salvataggi e conflitti

Il prodotto completo viene salvato in una transazione IndexedDB PRIMA di tentare l'invio. La cache è separata per progetto, negozio e UUID autenticato: cambiando operatore, una coda non viene inviata a nome di un altro utente. Le operazioni pendenti non hanno il vecchio limite di 80. I valori cloud non sovrascrivono i payload in attesa.

Ogni invio usa `sl_save_product`, una funzione SQL che verifica l'account e la versione del prodotto. Aggiornamento e storico sono una transazione unica; nome e ID dell'autore provengono dal server. Nessun permesso di scrittura diretta sulle tabelle prodotti, profili e log. Un conflitto lascia intatta la modifica locale. Aprire il prodotto e usare «Confronta con il negozio / Scarta modifica locale» per vedere data, stato e note remoti; la conferma scarta la copia locale. Poi riaprire il prodotto e inserire le modifiche corrette. Non c'è sovrascrittura automatica.

Accesso iniziale e verifica della sessione richiedono rete. Una sessione aperta può registrare modifiche locali senza rete; l'invio richiede nuovamente un account valido. Password/sessioni sono gestite dall'SDK Auth; le password non sono memorizzate dalla nostra app. I token di sessione dell'SDK e i dati locali rimangono sul dispositivo: usare dispositivi fidati e l'uscita per cambiare utente. La cache non è cifrata contro chi abbia accesso diretto al browser. Note e stati sono inclusi nello stesso payload offline; la bacheca richiede rete e segnala gli errori senza dichiarare successo.

## Funzioni presenti e limiti

Ricerca per EAN/nome/fornitore, scanner, filtri, scadenze, segnalato/gestito, esclusioni, non in negozio, note, storico, nuovi prodotti, bacheca, cambio password, CSV, stampa ed esportazione di dati e coda. Non ci sono turni/consegne/cassa, rinomina EAN, cancellazione prodotti, importazione backup o pannello di gestione account. Il backup JSON esporta stati e operazioni pendenti; non è ancora un ripristino automatico. Il catalogo è condiviso come origine, ma un prodotto nuovo aggiunto qui resta di San Lorenzo.

Il service worker mette in cache solo i file statici dell'app, non dati API né autenticazione, e non cancella cache di altre applicazioni. Per rilasci futuri aggiornare la versione cache. Le librerie CDN non vengono precaricate offline: a un avvio senza rete lo scanner/auth possono non essere disponibili. Non promettiamo un primo accesso completamente offline. Per una distribuzione finale è preferibile servire anche queste librerie localmente.

## Accesso del progettista a La Malfa

Questa copia concede all'amministratore l'accesso sicuro a San Lorenzo. NON crea una falsa integrazione con La Malfa: il vecchio database non ha gli account/permessi di questa app. Un ruolo nel nuovo progetto non autorizza operazioni sul precedente. Un pannello unico con gestione sicura di entrambi richiede un collegamento backend e autorizzazioni dedicate per La Malfa, da concordare separatamente perché il vincolo corrente vieta modifiche alla sua app e al suo database. Nel frattempo La Malfa continua a essere gestita con l'app e l'accesso esistenti.

## Verifiche

`node --test tests/core.test.cjs` verifica protezione del backend originale, esclusione chiavi segrete, conservazione payload offline, 100 operazioni pendenti, versioni, date/stati e CSV. `node --check app.js` verifica sintassi.

Verifica reale dopo il setup del nuovo backend:

- Nome corretto + password corretta entrano; password errata e account senza profilo non entrano. Un token anonimo non legge tabelle `sl_*`.
- Un operatore non può modificare `sl_profiles`, scrivere direttamente prodotti/log né ottenere privilegi dichiarando un nome diverso.
- Amministratore assente dal roster, presente nello storico delle proprie modifiche.
- Due dispositivi modificano lo stesso EAN: il secondo invio incontra un conflitto, conserva il payload e richiede confronto esplicito.
- In modalità offline salvare, ricaricare, poi accedere nuovamente con rete: il payload resta in coda e viene inviato. Cambiare account non invia le modifiche dell'altro.
- Provare blocco IndexedDB: il salvataggio segnala errore e non dichiara una persistenza riuscita.
- Fotocamera su iPhone Safari e Android Chrome, CSV/stampa, password nuova e bacheca.
- Confermare che sito, database e dati di La Malfa non abbiano subito alcun aggiornamento.

I controlli del database richiedono un progetto di prova effettivo: non sono stati eseguiti sul database di produzione. Prima dell'attivazione completare anche la procedura di backup/recupero del nuovo progetto.
