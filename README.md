# FIPAVonline Viewer

[Apri l’app](https://davidaffo.github.io/fipavonline-viewer/) · [Repository GitHub](https://github.com/davidaffo/fipavonline-viewer)

PWA con Vite e JavaScript, senza backend o proxy. Sorgenti in `src/`, asset statici in `public/`, ingresso in `index.html`. Manifest e service worker sono generati da `vite-plugin-pwa` durante la build.

## Avvio

```sh
npm install
npm run dev
```

Aprire http://127.0.0.1:5173. Vite aggiorna i sorgenti durante lo sviluppo. Il service worker è disattivato in sviluppo per evitare interferenze con HMR.

```sh
npm run build
npm run preview
```

La preview della build è su http://127.0.0.1:4173. Qui si possono provare installazione e uso offline. La build in `dist/` è autonoma e pubblicabile su qualsiasi hosting statico, anche sotto un sottopercorso. Per la PWA servono HTTPS o localhost.

```sh
npm run check
```

## Interfaccia

Il tema segue le impostazioni chiare o scure del dispositivo, anche quando cambiano a pagina aperta.

- **Calendario:** due viste: **Mese**, con la griglia, e **Lista**, con le schede delle partite. Nella Lista si sceglie **Tutte le date** oppure **Un giorno**, con oggi come data iniziale. Campionato, girone e squadra sono facoltativi e condivisi tra le modalità. La data scelta nella griglia viene mantenuta passando alla Lista e attiva il filtro Un giorno. La ricerca testuale resta nella scheda Società. “Nascondi partite già svolte”, disattivato di default, esclude le gare con stato Terminata dalla lista, dalla griglia e dai profili di società e squadra; lascia visibili live e gare senza risultato.
- **Classifica dalla partita:** ogni scheda apre la classifica del proprio girone e comitato, anche nei profili dei preferiti. “Torna alle partite” ripristina la vista e i filtri di partenza.
- **Società:** elenco ricavato dai calendari, con logo, codice di affiliazione, squadre e stella dedicata. Il preferito di una società include tutte le sue squadre nel filtro «Preferite», anche se partecipano a campionati o comitati diversi. La selezione del comitato continua a limitare i dati visualizzati.
- **Classifiche** e **Preferiti:** accessibili dalle rispettive schede.

## Esportazione Excel e ICS

I pulsanti separati **Excel** e **ICS** si trovano nelle schede di società e squadre, nei relativi profili e nel calendario filtrato per squadra. La selezione è già impostata sulla voce scelta; restano le opzioni per il formato del download. I pulsanti **Esporta Excel** ed **Esporta ICS** nella vista Società aprono anche la scelta di regione e comitato. Si possono scaricare i calendari di tutte le società, di una società o di una squadra; i nomi delle squadre includono categoria e girone. Dalla vista di una società o squadra viene preselezionato il relativo calendario.

Ogni pulsante apre il pannello del proprio formato, Excel (`.xlsx`) o iCalendar (`.ics`). È possibile creare un unico `.xlsx` con un foglio per società o squadra, oppure uno ZIP con un Excel per ciascuna voce. Comitato, campionato e girone compaiono nel titolo di ciascuna sezione del foglio. Le colonne predefinite contengono numero gara, giornata, data, ora, squadre e impianto. Le checkbox “Colonne opzionali” permettono di aggiungere arbitri, nomi e codici società, stato, risultato, parziali, omologazione e ID di gara e girone. Le opzioni si applicano sia al file unico sia a tutti i file dello ZIP. Anche nei pannelli Excel e ICS è presente “Nascondi partite già svolte”, disattivato di default: il filtro si applica ai calendari individuali e a quello complessivo, con conteggi aggiornati prima del download. L’esportazione di una società aggiunge sempre un calendario complessivo di tutte le sue squadre, ordinato per data e senza duplicare i derby: un foglio aggiuntivo nel file unico oppure un Excel aggiuntivo nello ZIP. Solo nel calendario complessivo Campionato e Girone sono colonne obbligatorie. I calendari separati mantengono i titoli per girone. I nomi dei file usano soltanto lettere senza accenti, numeri e trattini; le squadre includono categoria e girone per distinguere gli omonimi. Ogni file comprende un foglio Informazioni con la data dei dati e le eventuali sorgenti mancanti. I calendari esportati comprendono tutte le date e non dipendono dai filtri della vista. Una partita tra due società compare nei calendari di entrambe; un derby compare una volta nel foglio della società.

Con ICS valgono le stesse selezioni di regione, comitato, società e squadra e le stesse checkbox: i dati opzionali compaiono nella descrizione degli eventi. Un file unico riunisce tutte le gare selezionate senza duplicati; lo ZIP contiene un `.ics` per calendario, incluso quello complessivo della società. Gli identificativi degli eventi restano uguali tra calendario completo e calendari individuali.

Gli orari FIPAV sono interpretati nel fuso Europe/Rome, inclusa l'ora legale, ed esportati in UTC. Le gare con data ma senza orario diventano eventi giornalieri; quelle senza data valida vengono escluse e conteggiate nel menu. Gli eventi con orario durano 2 ore. “Includi riscaldamento” è disattivato di default; attivandolo aggiunge i minuti scelti (60 di default) alla durata, lasciando invariato l’orario d’inizio. Il nome del calendario è modificabile: viene usato dentro il file ICS e nel nome del download; nello ZIP diventa un prefisso dei calendari separati. Le gare senza orario restano eventi giornalieri. I dati provengono dall'ultima sincronizzazione disponibile: il file scaricato non è un abbonamento agli aggiornamenti. Il formato segue [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).

I file sono generati nel browser con ExcelJS per Excel e fflate per gli ZIP, caricati quando si apre l'esportazione. Il caricamento usa `createDataSource`, quindi supporta sia i JSON statici sia il futuro backend. Se una sorgente non risponde, usa la copia salvata nel browser quando disponibile e segnala l'esito prima del download. L'esportazione non aggiorna la cache di navigazione. Il backup JSON resta nelle Informazioni.

## Dati

Lo script Node scarica i JSON pubblici FIPAV fuori dal browser, li valida e li salva in `public/data/`. L'app legge questi file dallo stesso dominio, evitando il limite CORS. Non serve un backend durante la navigazione.

```sh
# Scelta interattiva: regione, poi tutti i comitati o un singolo comitato
npm run sync:fipav

# Un comitato e tutti i suoi gironi (può richiedere diversi minuti)
npm run sync:fipav -- 04000

# Oppure solo i gironi indicati, oltre a risultati ed elenco gironi
npm run sync:fipav -- 04000 35608

npm run build
```

Gli ID dei comitati sono in `public/committees.json`; quelli dei gironi nell'elenco scaricato. Lo script usa prima `data.fipavonline.it`, poi `app.fipavonline.it` dove previsto. Scarica sequenzialmente, applica un timeout a ogni richiesta e valida il formato prima di sostituire atomicamente ciascun file. Conserva il payload originale insieme a URL sorgente e data di scaricamento; il parser dell'app rielabora i dati per la visualizzazione. In caso di errori conserva i file precedenti, segnala quali download sono falliti ed esce con codice 1 anche se altri file sono stati aggiornati.

**Verifica del 16 ottobre 2026:** scaricato l'elenco reale dei gironi del comitato `04000`. L'endpoint live e il calendario `35608` rispondono 404; la risposta della classifica non è compatibile con il parser attuale. Scaricare fuori dal browser risolve CORS, ma non rende disponibili endpoint mancanti o risposte di formato diverso.

In sviluppo i file sono disponibili appena scaricati. Su hosting statico occorre eseguire la sincronizzazione prima della build e pubblicare di nuovo `dist/`, oppure aggiornare i file `data/` sull'hosting. La GitHub Action inclusa aggiorna e pubblica i dati una volta al giorno; attivazione e selezione dei comitati sono descritte in [docs/github-pages.md](docs/github-pages.md). Il pulsante Aggiorna e il controllo ogni 60 secondi leggono i file pubblicati, senza eseguire lo script. La data «Scaricati da FIPAV» resta quella del download, anche dopo successive letture.

In modalità statica l'app legge solo i JSON pubblicati sul proprio hosting. Se mancano, conserva gli ultimi dati locali o permette l'importazione manuale; non invia richieste API dirette a FIPAV dal browser. Non include risultati dimostrativi. Preferiti e risposte valide sono salvati in localStorage. Il service worker conserva l'interfaccia e l'elenco comitati, escludendo gli snapshot dalla precache; i dati consultati rimangono disponibili tramite localStorage. Nessun aggiornamento a pagina chiusa.

Per importare: selezionare un comitato, aprire `?`, aprire un collegamento JSON, salvare il file e scegliere “Importa JSON FIPAV”. Per calendari/classifiche senza ID nel file, selezionare prima il girone (importare prima il JSON dei gironi se necessario). Esportazione locale disponibile nelle informazioni.

## Verifica eseguita

Controlli di sintassi e test del parser passati. Verifica della build Vite in Chromium a 390 px e 1440 px: errore di connessione, importazione risultati/gironi/calendario/classifica, aggiunta e rimozione preferiti, rifiuto JSON estranei, assenza di overflow orizzontale su mobile e riapertura offline tramite service worker. Nessun errore JavaScript osservato. I flussi di importazione sono stati verificati con fixture di test, non con risultati live disponibili dal browser.

## Automazione e futuro backend

- [GitHub Actions: aggiornamento giornaliero e pubblicazione](docs/github-pages.md)
- [Sorgente dati e contratto del futuro backend](docs/data-api.md)

La configurazione giornaliera è in `config/sync.json` (inizialmente tutta la Liguria). Per provarla: `npm run sync:configured`. L'accesso ai dati del frontend è centralizzato in `src/data-source.js`; la modalità `static` usa gli snapshot, la modalità `api` usa il backend configurato tramite variabili d'ambiente. Preferiti e cache del browser restano compatibili.

Dalla lista **Preferiti**, selezionando una società o una squadra si apre una vista dedicata con tutte le partite disponibili, ordinate per data. Per le società vengono consultati tutti i comitati della stessa regione e sono elencate le squadre, apribili a loro volta. La vista squadra usa il comitato di origine del preferito. I dati già consultati restano utilizzabili offline; gli eventuali calendari mancanti sono segnalati. Il riquadro intero di ogni giorno nella griglia è un pulsante utilizzabile anche da tastiera.

Le squadre nei preferiti e nelle viste delle società mostrano categoria e girone abbreviati accanto al nome (per esempio `U19F · Gir. A` o `1DF · Gir. B`). Le sigle vengono lette dai metadati FIPAV; i preferiti precedenti sono completati usando i dati già salvati nel browser. Se una squadra partecipa a più gironi, sono mostrati tutti i contesti trovati.

Le schede **Società** e **Preferiti** usano lo stesso componente espandibile (`src/club-card.js`), aperto di default, con squadre, categorie/gironi e stelle. Lo stato aperto/chiuso della società è condiviso tra le due schede durante la sessione.
