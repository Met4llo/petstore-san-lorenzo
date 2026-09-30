# Pet Store — base comune, San Lorenzo

Il frontend si modifica in `shared/`, il catalogo in `catalog/`. La configurazione di San Lorenzo è in `stores/san-lorenzo.json`: non contiene password né chiavi segrete. `npm run build` genera solo `dist/san-lorenzo`, pronto per un sito dedicato. Il repository di La Malfa e il suo database non vengono toccati.

Questa è la prima base comune. Oggi l'unico negozio attivato su questa base è San Lorenzo. L'adattatore SQL e i controlli del frontend ammettono ancora solo San Lorenzo: la futura migrazione di La Malfa richiederà autorizzazione, backup, adattamento schema/account e verifica dati. Non basta cambiare URL o nome per collegare La Malfa. L'app precedente rimane operativa separatamente.

## Aggiornamenti

1. Modificare frontend o catalogo comuni.
2. Eseguire `npm run check`, `npm test`, `npm run build`.
3. Controllare i file generati e provare login, RLS, conflitti e scanner sul nuovo backend.
4. Pubblicare il negozio scelto. In futuro saranno due build della stessa sorgente, con rilasci indipendenti. Non aggiornare La Malfa automaticamente.

La versione del service worker deriva dal contenuto del codice/catalogo/configurazione, così non occorre ricordare di cambiare manualmente un numero cache. Per evitare di mescolare versioni, il worker deve essere rivisto prima di un rilascio in uso.

## GitHub Pages

Usare un nuovo repository `Met4llo/petstore-san-lorenzo`, mai `petstore-scadenze`. Impostare Settings → Pages → Source: GitHub Actions. Ogni push esegue i controlli e prepara un artifact revisionabile, senza pubblicare. Dopo i test reali, avviare manualmente il workflow «San Lorenzo - controlli e pubblicazione» sul branch main, selezionando publish. Il sito risultante sarà quello del nuovo repository; il sito di La Malfa non cambia.

## Database e account

Lo schema San Lorenzo è già stato eseguito dall'utente: NON rieseguire `database/setup-san-lorenzo.sql`. I cinque account e profili sono stati creati manualmente. URL/chiave pubblicabile del nuovo progetto sono configurati; i controlli Auth/RLS reali devono ancora essere completati. Vedere `SETUP-SAN-LORENZO.md` per i dettagli di funzionamento, le limitazioni e le prove manuali. In quella guida i percorsi originari `database/setup.sql`, `core.js`, `app.js` corrispondono qui a `database/setup-san-lorenzo.sql`, `shared/core.js`, `shared/app.js`.

L'accesso amministratore è sicuro solo per San Lorenzo: nessuna integrazione amministrativa con La Malfa è stata attivata. Non chiedere agli operatori le password per verificare il sistema: usare un account di prova creato appositamente nel nuovo progetto.
