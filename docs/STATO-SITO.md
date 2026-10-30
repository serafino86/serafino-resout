# Sito Serafino Résout — stato 30 ottobre 2026

La home presenta l'attività complessiva: marketing e pubblicità, opportunità commerciali, IA locale, strumenti su misura e automazioni. La linea telefonica è una soluzione tra le altre. Nessun nome di cliente nei nuovi contenuti pubblici.

## Pagine pubbliche e SEO

Home + 10 pagine di servizi + reservations: 12 URL in sitemap. Ripristinati gli URL automazione, applicazioni, formazione, bot, HORECA, artigiani, PMI e Ginevra; aggiunte pagine specifiche marketing/pubblicità e IA locale. Le pagine hanno titolo e descrizione specifici, canonical su dominio senza www, robots index/follow, collegamenti interni e dati strutturati. Non è una certificazione del posizionamento o dell'indicizzazione effettiva nei motori di ricerca.

Recupero selettivo dalla struttura del commit `9960311`, non rollback integrale. Non ripristinare vecchi prezzi, promesse di risultato, abbonamenti azzerati per ogni servizio o affermazioni di produzione sulle demo. Una migrazione prevista non va presentata come già effettuata.

## Server

Il 28 ottobre erano stati introdotti redirect nginx dalle pagine servizi alla home. Rimossi per pme, geneve, horeca, artisans e bot-personalise. Restano ritirate centralina, diagnostic e calculateur. HTML pubblico con Cache-Control no-cache. I collegamenti agli URL ripristinati contengono una versione per evitare i vecchi redirect eventualmente già memorizzati dai browser.

`deploy.sh` non deve eliminare app-sur-mesure, automatisation o formation-ia: tolte dall'elenco RETIRED.

Radar e demo restano esclusi dalla navigazione e dalla sitemap. Le applicazioni private e le loro protezioni non sono state modificate. Il vecchio URL del caso cliente ritirato contiene soltanto un rinvio senza nome alla sezione anonima della home; le tre relative immagini sono state archiviate fuori dal sito.

## Bot

Prompt e KB allineati ai servizi reali. Non presentare l'intera attività come un solo prodotto né affermare che il fondatore non abbia clienti: la fase pilota riguarda la sola linea. Lavori e casi anonimi, stato ristoranti pilota e artigiani in preparazione. Immagine `serafino-bot:20261030-servizi`, derivata dal runtime già installato, senza aggiornamenti di dipendenze.

## Verifica e recupero

Prove browser su tutte le 12 pagine a 1440 e 390 px: risposta HTTP, H1, indicizzabilità dichiarata, canonical, JSON-LD, collegamenti e overflow; JavaScript senza errori. Controllare tutte le pagine online dopo ogni pubblicazione, non soltanto la home. Non promettere recupero automatico del ranking SEO.

Backup e rapporto operativi riservati fuori dal repository pubblico. Le modifiche nginx vivono sul VPS e vanno preservate nei deploy successivi.

## Audit UX e marketing completati

Due agenti indipendenti hanno esaminato il sito online e le immagini desktop/mobile, poi riesaminato le correzioni locali. Il coordinatore ha pubblicato e verificato la versione finale online; l'agente marketing ha inoltre confermato la lettura finale di sei pagine pubbliche.

- Titolo iniziale esplicito: marketing, IA locale e strumenti su misura. Slogan personale secondario.
- Tre percorsi principali in home, mantenendo tutte le 12 pagine. Realizzazioni anonime subito dopo i servizi, prima del metodo.
- Contatti dichiarano l'azione Appeler/Écrire; navigazione comune anche sulla pagina della linea. Eliminate le affermazioni assolute sulle prenotazioni perse.
- Testi delle schede a 16 px e peso 400, colori con contrasto misurato superiore a 4,5:1 sui testi controllati, bersagli principali di almeno 44 px.
- Menu chiudibile con Escape e click esterno, salto al contenuto, focus visibile, contenuti leggibili senza JavaScript e preferenza di movimento ridotto rispettata.
- Chat in dialogo nativo nominato: controlli non esposti quando chiusa, focus iniziale sul comando di chiusura, sfondo non interattivo, chiusura e ritorno del focus. Nessuna apertura automatica.
- Anche il frontend del bot è aggiornato: saluto e tre suggerimenti sui servizi generali in quattro lingue, controlli nominati e testo leggibile. La sola correzione della KB non aggiornava il saluto statico. Nuova immagine `serafino-bot:20261030-ux` sul runtime esistente.

Collaudo finale pubblico: 12 pagine × 2 viewport = 24 controlli riusciti; ulteriori 23 controlli di interazione/accessibilità, incluse larghezze 320–1440 px, contrasto, navigazione senza JavaScript e chat con iframe reale. Prova completa del suggerimento pubblicità: risposta HTTP 200 e contenuto pertinente, senza inviare email o chiamate. Nessun risultato di conversione o certificazione WCAG dedotto da questi controlli.

Conservare `assets/audit-ui.css` e `assets/site-ui.js`, condivisi dalle dodici pagine, e il saluto aggiornato in `bot/bot.html`. Un futuro ripristino dei vecchi HTML non deve reintrodurre gli stessi problemi.
