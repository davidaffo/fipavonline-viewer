# Dati delle partite

Verifica sui 2.336 incontri nei calendari liguri scaricati il 16 ottobre 2026.

| Campo FIPAV | Visualizzazione |
| --- | --- |
| `team1`, `team2`, `logo` | Squadre affiancate, loghi e preferiti |
| `team1-setwin`, `team2-setwin` | Risultato centrato sotto le squadre |
| `pt_a`, `pt_b` | Parziali numerati sotto il risultato |
| `date`, `time` | Data e ora (formato normalizzato `19:00`) |
| `day` | Giornata di campionato, distinta dalla data |
| `ng` | Numero gara |
| `played`, `is_live` | In programma, in corso, risultato parziale o terminata |
| `ris_ufficiale` | Risultato ufficiale/non ufficiale per gare terminate, se il campo è presente |
| `stadium` | Impianto e indirizzo forniti dalla fonte |
| `lat-stadium`, `lng-stadium` | Collegamento alla mappa quando le coordinate sono valide |
| `1referee`, `2referee` | Primo e secondo arbitro, quando indicati |
| `team*.nome_societa`, `team*.cod_aff_societa` | Nome società sopra al logo con stella dedicata; codice nel testo del tooltip |

Nel download esaminato 94 incontri risultano giocati; 86 hanno il flag di risultato ufficiale. Il primo arbitro è presente in 211 incontri, il secondo in 62. L'assenza del nome è indicata come «Arbitri non indicati» senza dedurre che non ci sia stata una designazione.

`id`, `id_girone` e gli ID delle squadre identificano dati e preferiti. `ts_gara` è già usato come alternativa per ricavare la data. `type` descrive il formato del dato.

I campi `gif_path` e `file_name` contengono soltanto le stringhe segnaposto omonime, quindi non permettono di costruire un collegamento a documenti o referti. `escorevolley` è sempre `0` nei calendari esaminati. `sp_a` e `sp_b` sono vuoti; non vengono interpretati come punteggi. I parziali mostrati provengono solo da `pt_a` e `pt_b`.
