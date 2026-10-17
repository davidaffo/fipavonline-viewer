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

Nelle liste **Società** e **Preferiti** e nelle squadre del profilo società, le checkbox accanto alle voci permettono di selezionare società intere o singole squadre. **Seleziona tutte** seleziona le voci visualizzate. Con almeno una voce selezionata compaiono **Esporta Excel** ed **Esporta ICS**; il pannello contiene le opzioni del file, senza ripetere la selezione. Se una squadra è selezionata anche attraverso la propria società, il suo calendario viene incluso una sola volta. Con un solo calendario si scarica direttamente un file; con più calendari si può scegliere un file unico oppure file separati nello ZIP. I profili di società e squadra e il calendario filtrato per squadra mantengono i pulsanti di esportazione diretta.

Ogni pulsante apre il pannello del proprio formato, Excel (`.xlsx`) o iCalendar (`.ics`). È possibile creare un unico `.xlsx` con un foglio per società o squadra, oppure uno ZIP con un Excel per ciascuna voce. Comitato, campionato e girone compaiono nel titolo di ciascuna sezione del foglio. Le colonne predefinite contengono numero gara, giornata, data, ora, squadre e impianto. Le checkbox “Colonne opzionali” permettono di aggiungere arbitri, nomi e codici società, stato, risultato, parziali, omologazione e ID di gara e girone. Le opzioni si applicano sia al file unico sia a tutti i file dello ZIP. Anche nei pannelli Excel e ICS è presente “Nascondi partite già svolte”, disattivato di default: il filtro si applica ai calendari individuali e a quello complessivo, con conteggi aggiornati prima del download. Il flag Excel **Includi foglio complessivo con campionato e girone**, attivo di default per le società e disattivo per più squadre selezionate, aggiunge un calendario complessivo di tutte le sue squadre, ordinato per data e senza duplicare i derby: un foglio aggiuntivo nel file unico oppure un Excel aggiuntivo nello ZIP. Solo nel calendario complessivo Campionato e Girone sono colonne obbligatorie. I calendari separati mantengono i titoli per girone. I nomi dei file usano soltanto lettere senza accenti, numeri e trattini; le squadre includono categoria e girone per distinguere gli omonimi. Ogni file comprende un foglio Informazioni con la data dei dati e le eventuali sorgenti mancanti. I calendari esportati comprendono tutte le date e non dipendono dai filtri della vista. Una partita tra due società compare nei calendari di entrambe; un derby compare una volta nel foglio della società.

Con ICS valgono le stesse selezioni di regione, comitato, società e squadra e il filtro sulle gare svolte. Il titolo degli eventi usa il codice compatto di campionato e girone, seguito da squadra di casa e ospite, ad esempio `2DFA-PGS Auxilium-Normac AVB`. L’impianto e l’indirizzo della fonte sono inseriti nel campo Luogo (`LOCATION`); gli eventi non contengono descrizioni aggiuntive. Le checkbox delle colonne opzionali restano nel solo pannello Excel. Un file unico riunisce tutte le gare selezionate senza duplicati; lo ZIP contiene un `.ics` per calendario, incluso quello complessivo della società. Gli identificativi degli eventi restano uguali tra calendario completo e calendari individuali.

Gli orari FIPAV sono interpretati nel fuso Europe/Rome, inclusa l'ora legale, ed esportati in UTC. Le gare con data ma senza orario diventano eventi giornalieri; quelle senza data valida vengono escluse e conteggiate nel menu. Gli eventi con orario durano 2 ore. “Includi riscaldamento” è disattivato di default; attivandolo anticipa l’inizio dei minuti scelti (60 di default) e li aggiunge alla durata. La fine resta due ore dopo l’orario della gara. Il nome del calendario è modificabile: viene usato dentro il file ICS e nel nome del download; nello ZIP diventa un prefisso dei calendari separati. Le gare senza orario restano eventi giornalieri. I dati provengono dall'ultima sincronizzazione disponibile: il file scaricato non è un abbonamento agli aggiornamenti. Il formato segue [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).

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

La voce **Partite preferiti** nel menu principale riunisce le gare di tutte le squadre salvate, anche di comitati diversi, ordinate per data. Una gara tra due squadre preferite compare una volta sola. Riutilizza le schede partita, il filtro **Nascondi partite già svolte** e i pulsanti di esportazione Excel e ICS. Le società preferite restano nella vista **Preferiti**.

Nel foglio complessivo delle squadre selezionate, le partite sono ordinate per data, i derby compaiono una sola volta e le colonne Campionato e Girone identificano la categoria di ogni gara. Disattivando il flag si mantengono soltanto i fogli individuali. La scelta vale anche per gli Excel separati nello ZIP.

Da **Preferiti**, selezionare le checkbox di squadre o società e premere **Salva come vista**. Si possono assegnare un nome e scegliere i contenuti; la vista viene aggiunta al menu principale e salvata nel browser insieme ai preferiti. **Modifica vista** permette di cambiare nome e selezione, **Elimina vista** la rimuove. Le viste riutilizzano il caricamento delle partite dei preferiti, il filtro sulle gare concluse, le schede partita e l’esportazione Excel/ICS. La selezione di una vista resta salvata anche se una voce viene successivamente rimossa dai preferiti.

Se si esportano almeno due società in Excel, il flag **Includi un foglio unico per tutte le società selezionate** aggiunge un riepilogo generale con campionato e girone, ordinato per data e senza gare duplicate. È indipendente dal flag per i riepiloghi delle singole società e funziona anche nello ZIP come Excel aggiuntivo.

Il pulsante **Crea nuova vista** nel menu principale apre lo stesso editor anche senza preferiti: scegliere un comitato, cercare società o squadre e spuntare le voci da includere. Le scelte restano selezionate cambiando comitato. Anche **Modifica vista** permette di aggiungere voci non preferite. Viste e preferiti rimangono in `localStorage` nel browser; non vengono scritti nel repository o su un backend.

Nel foglio unificato di più società, la prima colonna **Società** indica solo le società selezionate coinvolte in ciascuna partita. Se due società selezionate si incontrano, entrambe compaiono nella stessa cella e la gara rimane su una sola riga. Seguono Campionato e Girone; Società casa e Società ospite restano colonne opzionali.
