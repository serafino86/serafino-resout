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
