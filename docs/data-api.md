# Sorgente dati e passaggio al backend

L'interfaccia usa `createDataSource()` in `src/data-source.js`. Questo modulo gestisce URL, richieste, annullamento e validazione. Calendario, giornata, classifiche, preferiti e cache del browser non dipendono dalla modalità di trasporto.

## Configurazione

Oggi, senza backend:

```dotenv
VITE_DATA_SOURCE=static
```

In futuro, con un backend:

```dotenv
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=https://api.example.com/api/v1/
```

Copia `.env.example` in `.env.local` per lo sviluppo. Le variabili Vite vengono incorporate durante la build: dopo averle cambiate occorre ricostruire il sito. Nella Action usa le variabili del repository `DATA_SOURCE=api` e `API_BASE_URL=https://…/api/v1/`. In modalità API la Action salta download e archiviazione degli snapshot, ma continua a pubblicare l'interfaccia.

Il backend può anche stare sullo stesso dominio, con `VITE_API_BASE_URL=/api/v1/`. Se sta su un dominio diverso deve autorizzare il dominio dell'app con CORS. Il client attuale non invia credenziali; l'eventuale autenticazione si aggiungerà nel solo modulo della sorgente dati.

## Contratto HTTP

Tutte le risposte riuscite hanno stato 200, tipo `application/json` e questa struttura:

```json
{
  "at": 1792157920710,
  "json": { "data": { "id": "63842", "title": "Seconda Divisione Femminile - Girone A", "matches": [] } }
}
```

`at` è il timestamp Unix in millisecondi dell'acquisizione effettiva dei dati FIPAV, non dell'apertura della pagina. `json` conserva il payload FIPAV, incluse le varianti già supportate dal parser. Il client assegna la provenienza senza richiederla al backend. Gli ID sono stringhe, così gli zeri iniziali dei comitati restano intatti.

| Risorsa | Percorso sotto `VITE_API_BASE_URL` | Contenuto di `json` |
| --- | --- | --- |
| Gironi | `committees/03008/groups` | `{ "data": [{ "type": "Calendar", "id": "63842", "title": "…", "parent": "Seconda Divisione Femminile", "parent-id": "15529", "sub-title": "Girone A" }] }` |
| Calendario | `committees/03008/calendar/63842` | `{ "data": { "id": "63842", "title": "…", "matches": [] } }` |
| Classifica | `committees/03008/standings/63842` | `{ "data": { "id": "63842", "title": "…", "teams": [] } }` |
| Risultati live | `committees/03008/live` | `{ "data": { "championship": [] } }` |

Per dati assenti rispondere 404; per errori temporanei usare 5xx. L'app conserva gli ultimi dati consultati. Un elenco vuoto valido restituisce 200 con un array vuoto, non un errore. La giornata continua a raccogliere i calendari dei vari gironi con al massimo quattro richieste contemporanee, integrando i risultati live disponibili. L'elenco generale dei comitati resta un asset statico del frontend.

La sincronizzazione e il parser sono riutilizzabili anche in un processo del backend: `syncCommittee()` in `scripts/sync-fipav.mjs` non dipende da GitHub Actions. Se il futuro backend preferisce un formato diverso, sarà sufficiente adattare `src/data-source.js` per restituire `{json, at, source}` al resto dell'app.
