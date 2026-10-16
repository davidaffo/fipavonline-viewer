# Pubblicazione giornaliera su GitHub Pages

Il workflow `.github/workflows/daily-pages.yml` viene avviato:

- ogni giorno alle **05:17 Europe/Rome**, con cambio automatico dell'ora legale;
- manualmente da **Actions → Aggiorna dati e pubblica → Run workflow**;
- dopo un push su `main`.

Le esecuzioni sono serializzate. GitHub può ritardare gli avvii pianificati; non è un servizio di aggiornamento in tempo reale.

## Attivazione

1. Caricare il progetto completo in un repository GitHub con branch `main`, inclusi `package-lock.json`, `public/committees.json` e gli eventuali snapshot iniziali.
2. In **Settings → Pages → Build and deployment → Source**, scegliere **GitHub Actions**.
3. Consentire al workflow la scrittura sul branch `data-snapshots`. Non occorrono token personali: usa il `GITHUB_TOKEN` della Action con i permessi dichiarati nel workflow. Eventuali regole dell'organizzazione o del branch devono consentire questa scrittura.
4. Verificare `config/sync.json` e avviare la prima esecuzione manuale.

Repository: [davidaffo/fipavonline-viewer](https://github.com/davidaffo/fipavonline-viewer). Sito: [FIPAVonline Viewer](https://davidaffo.github.io/fipavonline-viewer/). Lo stato di sincronizzazione e pubblicazione si controlla nella scheda [Actions](https://github.com/davidaffo/fipavonline-viewer/actions).

## Quali dati aggiornare

La configurazione iniziale aggiorna tutta la Liguria: comitato regionale (`03000`), Centro (`03008`), Ponente (`03011`) e Levante (`03104`). Nell’app il menu Comitato seleziona quali dati caricare e visualizzare: gli altri comitati non vengono scaricati dal browser. Per aggiungere comitati:

```json
{
  "committees": ["03008", "03011"],
  "regions": []
}
```

Per includere un'intera regione:

```json
{
  "committees": [],
  "regions": ["Liguria"]
}
```

I nomi delle regioni e gli ID devono corrispondere a `public/committees.json`. Le due selezioni si sommano senza duplicati. Per ciascun comitato si aggiornano risultati, elenco gironi, calendari e classifiche. I download verso FIPAV sono sequenziali, con un timeout per richiesta. Aggiungere molte regioni può richiedere di aumentare il limite di 90 minuti del job.

Lo stesso comando funziona in locale senza domande interattive:

```sh
npm run sync:configured
```

Il comando interattivo `npm run sync:fipav` resta disponibile.

## Errori e conservazione

Prima della sincronizzazione il workflow ripristina gli ultimi snapshot dal branch `data-snapshots`. Alla prima esecuzione usa quelli presenti nel checkout. Le risposte valide sostituiscono atomicamente un file; gli errori lasciano intatti il file e la data precedenti. Se l'elenco gironi è temporaneamente irraggiungibile, lo script usa quello precedente per aggiornare ancora i calendari.

Un errore parziale produce un avviso e un riepilogo nella Action, mentre i dati scaricati correttamente vengono pubblicati insieme ai precedenti. Se non si scarica nessun file valido, il job fallisce e il sito pubblicato resta invariato. Anche gli errori di test, build o salvataggio bloccano la pubblicazione.

`public/data/sync-status.json` riporta l'esito complessivo e gli errori per comitato. Le date mostrate nell'app restano quelle dei singoli dati; il timestamp del report non indica che tutti i file siano stati aggiornati.

Il branch `data-snapshots` contiene solo `public/data/` e mantiene la cronologia giornaliera senza commit automatici su `main`. Togliere un comitato dalla configurazione interrompe i suoi aggiornamenti, ma non elimina i dati già conservati: restano consultabili con la loro data originale.

Il job crea `dist/` e lo pubblica tramite le azioni ufficiali di Pages. La build supporta il sottopercorso del repository. Non serve un server applicativo.

## Passaggio al backend

Impostare le variabili del repository **DATA_SOURCE=api** e **API_BASE_URL** e rilanciare il workflow. I passaggi di sincronizzazione vengono saltati. Il contratto del backend e la configurazione locale sono in [data-api.md](data-api.md). Quando il backend aggiornerà autonomamente i dati, si potrà rimuovere il trigger `schedule` e mantenere la pubblicazione dell'interfaccia ai push.

Riferimenti: [workflow Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [pianificazione GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Per i repository pubblici GitHub può disabilitare la pianificazione dopo 60 giorni senza attività; controllare lo stato della Action.
