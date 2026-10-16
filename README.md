# Volley Live

PWA statica, senza backend, framework, proxy o dipendenze runtime. HTML/CSS/JavaScript in `dist/`.

## Avvio

```sh
npm run dev
```

Aprire http://127.0.0.1:5173. Per installazione e service worker servono HTTPS o localhost. Il contenuto di `dist/` può essere pubblicato su qualsiasi hosting statico anche sotto un sottopercorso.

```sh
npm run check
```

## Dati

Richieste dirette a `data.fipavonline.it`, con fallback ad `app.fipavonline.it` per calendario e classifiche. I risultati live usano il JSON pubblico indicato dal sito FIPAV. Nessuna chiave o autenticazione.

**Limite verificato il 16 ottobre 2026:** nelle risposte provate gli endpoint FIPAV non includono `Access-Control-Allow-Origin` per localhost e per il dominio dell'app. Il browser può pertanto impedire la lettura dei dati da una PWA su un altro dominio. Alcuni JSON risultano inoltre assenti (404). Non si usano proxy o aggiramenti CORS. Per attivare il live serve che FIPAV autorizzi il dominio; una risposta valida da curl non dimostra l'accessibilità dal browser.

L'app segnala il problema e permette di aprire le sorgenti e importare manualmente i JSON originali. Non include risultati dimostrativi. Il file `committees.json` è un elenco iniziale ricavato dal servizio pubblico FIPAV; non contiene dati di partite.

Preferiti e risposte valide sono salvati in localStorage. Le risposte importate sono etichettate; data/ora mostrate indicano la ricezione/importazione, non l'ultimo aggiornamento della fonte. Il service worker conserva solo l'interfaccia e l'elenco comitati. Nessun aggiornamento in background a pagina chiusa; controllo ogni 60 secondi a pagina visibile.

Per importare: selezionare un comitato, aprire `?`, aprire un collegamento JSON, salvare il file e scegliere “Importa JSON FIPAV”. Per calendari/classifiche senza ID nel file, selezionare prima il girone (importare prima il JSON dei gironi se necessario). Esportazione locale disponibile nelle informazioni.

## Verifica eseguita

Controlli di sintassi e test del parser passati. Verifica Chromium a 390 px e 1440 px: errore di connessione, importazione risultati/gironi/calendario/classifica, aggiunta e rimozione preferiti, rifiuto JSON estranei, assenza di overflow orizzontale su mobile e riapertura offline tramite service worker. Nessun errore JavaScript osservato. I flussi di importazione sono stati verificati con fixture di test, non con risultati live disponibili dal browser.
