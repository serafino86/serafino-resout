# SPEC — Sito serafino-resout.ch, nuova linea (09.11.2026)

Autore: ingegnere (Marco Bernasconi). Stato: **DA APPROVARE**, niente implementato.
Fonte dei problemi: `AUDIT-2026-11-09.md` (30 problemi, numerati #1-#30 sotto).
Decisioni di Enrico usate: memoria `serafino_figura_pubblica.md` (09.11: campo allargato, accento = marchio, 8 format, carattere di Serafino), `feedback_come_presentare_enrico.md` (bio corta, mai «consulente BP/finanziamenti»), `demos_non_produzione.md`, `guardrail_repo_pubblico.md`, `feedback_verifica_completa.md`.
Percorso di vendita e prezzi indicativi: `~/Serafino-Social/TREND-ESTERI-E-FORMAT-2026-11-09.md` §6 (prezzi DA VERIFICARE).

⚠️ Il repo `serafino86/serafino-resout` è PUBBLICO: in questa spec e nei testi del sito niente nomi di clienti, margini, compensi, prezzi interni. I prezzi entrano nel sito solo dopo la decisione E1.

Già fuori perimetro (li archivia un altro operaio in parallelo, qui si considerano rimossi): `radar-pme/`, `guide/`, 2 pagine `suggeritore-prova`, pagina festa. Questa spec si occupa solo dei loro **URL** (redirect/410) e della sitemap.

---

## 1. Obiettivi

1. Chi arriva dalla bio IG/FB trova **Enrico/Serafino** (video con l'accento) e 3 porte chiare: «Mes essais», «Apprendre l'IA», «Pour votre entreprise» (#1, #2, #17).
2. Da 11 pagine servizi sottili a **4 pagine forti** + Ligne separata, con 301 da tutti i vecchi URL (#11, #29).
3. Accessibilità: tutti i testi ≥ 4,5:1, niente testo funzionale < 12 px, un solo sistema tipografico (#7, #8, #21, #25).
4. Via i tic grafici «da IA» segnalati da `impeccable detect` (crema, glow arancione, etichette maiuscole sopra i titoli, serif corsivo ovunque) (#9, #10).
5. Testi nella voce di Enrico (skill `voce-enrico` + `unslop`), niente antitesi a specchio né «sur mesure» ripetuto (#12-#15).
6. Repo = verità: niente modifiche live non committate, deploy solo da commit (#4).
7. Funziona su telefono 390 px senza scorrimento orizzontale (#30).

Non obiettivi (scelte di semplicità): nessun framework, nessun generatore di pagine, nessun CMS. HTML statico come oggi. Nessun nuovo backend: le iscrizioni passano da mail/telefono finché E5 non è deciso.

---

## 2. Mappa URL vecchie → nuove

Convenzione: si resta su file `.html` alla radice (come oggi), canonical senza `www`.

| Vecchio URL | Nuovo | Codice | Nota |
|---|---|---|---|
| `/` | `/` | 200 | home rifatta |
| `/pme.html` | `/entreprises.html` | 301 | |
| `/artisans.html` | `/entreprises.html` | 301 | |
| `/horeca.html` | `/entreprises.html` | 301 | |
| `/automatisation.html` | `/entreprises.html` | 301 | |
| `/app-sur-mesure.html` | `/entreprises.html` | 301 | |
| `/marketing-publicite-geneve.html` | `/entreprises.html` | 301 | |
| `/geneve.html` | `/entreprises.html` | 301 | |
| `/formation-ia.html` | `/apprendre-ia.html` | 301 | file rinominato con `git mv` |
| `/ia-locale-geneve.html` | `/ia-chez-vous.html` | 301 | file rinominato con `git mv` |
| `/bot-personalise.html` | `/ia-chez-vous.html` | 301 | |
| (nuovo) | `/essais.html` | 200 | «Mes essais» |
| `/reservations.html` | `/reservations.html` | 200 | Ligne, prodotto separato |
| `/privacy.html` | `/privacy.html` | 200 | aggiornata (font, social) |
| `/enrico-la-noce/` | invariato | 200 | CV, `noindex`, fuori dalla nav |
| `/demos/puliziapro.html` | invariato | 200 | demo dichiarata, `noindex`, link sistemati |
| `/centralina.html`, `/diagnostic.html`, `/calculateur.html` | `/` | 301 | già così sul VPS: conservare |
| `/cas-planeto.html` | `/entreprises.html` | 301 | file archiviato, nome non più pubblicabile |
| `/guide/` (e sotto) | `/apprendre-ia.html` | 301 | la futura guida vivrà lì |
| `/radar-pme/` (e sotto) | — | 410 | radar congelato; non redirigere (contenuto diverso) |
| `/suggeritore-prova*`, pagina festa | — | 404 | nessun redirect: la festa conteneva dati privati |
| `/app/demo` | link diretto `/app` | — | solo cambio href (#28) |

Dove vivono i redirect (scelta tecnica): **un file `deploy/nginx-redirects.conf` versionato nel repo** (contiene solo `location = /x.html { return 301 /y.html; }` e il 410, niente segreti, ok in repo pubblico), incluso dal `nginx.conf` del container sul VPS (`/docker/serafino-resout/nginx.conf`) con una riga `include`. Motivo: oggi i redirect esistono solo sul VPS e un deploy li può perdere senza traccia (STATO-SITO.md). Il file vecchi URL va anche in `RETIRED` di `deploy.sh`, così i file morti spariscono dal server (deploy senza `--delete`, come da regola).

---

## 3. Contenuto per pagina (cosa dice, non il testo finale)

Regole comuni a tutti i testi:
- Prima persona, Enrico. Serafino è il nome/carattere: libero, diretto, mai venditore né guru. Qualche costruzione italiana va bene se si capisce (accento = marchio).
- Ogni sezione ha **un fatto concreto** (una prova vera, una macchina, un numero, un caso anonimo). Demo sempre dichiarate demo. Mai «déployé / en production / clients» per PuliziaPro o DGE.
- Bio: il testo approvato del 30.10 («Une passion d'enfance…») e la frase del nonno **non si toccano**.
- Vietati: antitesi a specchio («pas X, mais Y», «Le travail reste humain. Le désordre…»), trattini lunghi, «sur mesure» più di 1 volta per pagina, etichette tipo «Nouveau», drammatizzazioni («l'erreur coûte cher»).
- Ogni pagina finisce con UNA azione concreta (scrivere, chiamare, iscriversi), non con tre.

### 3.1 Home `/` (≤ 600 parole visibili, oggi 1'174)
1. **Hero**: video verticale breve di Enrico che parla francese con l'accento (E3), frase sua tipo «je teste l'IA chez moi, à Genève, et je vous montre comment faire». Nome + Genève. Bottoni: IG, FB.
2. **3 porte** (3 card uguali, una riga ciascuna + link): Mes essais → `/essais.html`; Apprendre l'IA → `/apprendre-ia.html`; Pour votre entreprise → `/entreprises.html`. Sotto, una riga piccola verso «IA chez vous» e una verso la Ligne.
3. **Ultimo essai**: 1 card presa da `/essais.html` (miniatura + titolo + link).
4. **Qui je suis** (`#qui`): bio approvata + foto + frase del nonno, invariate. Una frase sul carattere di Serafino presa dalle parole di Enrico del 09.11 (citazione breve, in FR, da far approvare a Enrico: E6).
5. **Contact**: telefono, mail `contact@serafino-resout.ch`, IG, FB.
6. Footer comune. Il bot chat resta solo in home come oggi.
Tolti dalla home: elenco 10 servizi, 3 settori, metodo, FAQ, blocco Ligne grande (resta un link).

### 3.2 Mes essais `/essais.html` (nuova)
- Cosa provo e perché: 2 righe.
- Elenco di card (dal più recente): miniatura JPG statica, titolo, data, 2-3 righe, link al Reel su IG/FB. **Niente embed Meta** (scelta nLPD: gli embed caricano script e cookie di Meta senza consenso). Al lancio almeno 2 essais scritti da esperimenti veri (es. Ollama sull'Omen in casa, dettatura locale in FR) senza nomi di clienti né di studi.
- Fine pagina: «suivez sur Instagram» + porta verso Apprendre l'IA.
- Manutenzione: 1 card a settimana, copia-incolla di un blocco HTML (istruzioni in commento HTML in cima alla lista).

### 3.3 Apprendre l'IA `/apprendre-ia.html` (da formation-ia, #3, #13)
- Per chi: persone normali, non solo dipendenti di aziende. Parte da un esempio vero e dice cosa si impara in concreto.
- **3 formati** in 3 blocchi uguali: Webinar (45 min, online, giovedì sera), Atelier in piccolo gruppo (6 persone, 2 × 2 h, Ginevra o online), Lezione privata (1 h 30, a casa o in video). Per ognuno: durata, dove, prezzo (E1) o «tarif sur demande», prossima data (E2) o «prochaine date annoncée sur Instagram».
- Iscrizione: link `mailto:` con oggetto precompilato per formato + telefono. Nessun modulo finché E5 non è deciso.
- Spazio previsto (commentato nell'HTML) per la futura guida gratuita in cambio della mail.
- Una riga verso «IA chez vous» (installazione dopo la lezione).

### 3.4 IA chez vous `/ia-chez-vous.html` (da ia-locale + bot-personalise, #16)
- L'esperimento vero raccontato: la macchina di casa (Omen, scheda grafica 8 GB), cosa ci gira, cosa costa in corrente/abbonamento rispetto a un abbonamento cloud. Una foto vera (E4).
- Offerta: IA privata installata sul PC di casa o del negozio + 1 h di presa in mano; per chi tiene ai propri dati (riferimento nLPD in una frase, senza promesse legali). Prezzo «à partir de» (E1) o su richiesta.
- Il «bot personalizzato» diventa una sezione breve: un assistente che risponde sui propri documenti; esempio = il bot di questo sito (reale) o demo dichiarata.
- Azione: scrivere/chiamare.

### 3.5 Pour votre entreprise `/entreprises.html` (unisce 7 pagine, #11, #14)
- Per chi: ristoranti, artigiani, piccole aziende di Ginevra. Una frase, niente elenco di settori a card.
- 3 cose che faccio, una sezione ciascuna con un fatto: marketing e pubblicità locale; outils e automazioni (app, fogli, mail); l'IA installata (link a IA chez vous).
- **2 casi anonimi** già presenti in home (spostati qui, ancora `#cas`), senza nomi.
- Demo: PuliziaPro dichiarata «entreprise fictive», link alla demo.
- Riga verso la Ligne (`/reservations.html`).
- Azione: chiamare o scrivere per un primo scambio.
- SEO: title/description con «Genève», «PME», «restaurants», «artisans» (le parole delle 7 pagine assorbite), così le 301 portano il traffico su una pagina che parla di quei temi.

### 3.6 Ligne `/reservations.html` (#7, #15, #22)
- Contenuto invariato nei fatti (prodotto, demo sul numero demo, prezzo). Tolti: 12 trattini lunghi, titoli-slogan, elenco di problemi drammatizzati.
- Piano 119 HT: si mostra o no secondo E7.
- Design portato sul sistema comune (oggi usa Instrument Serif + DM Sans + stili inline).

### 3.7 Pagine minori
- `privacy.html`: font locali (quindi niente più Google Fonts da citare), menzione dei link IG/FB (nessun embed).
- `enrico-la-noce/`: solo `og:image` (#23). La frase «Équivalence CFC reconnue par le SEFRI» si verifica alla fonte (NotebookLM d0739f55 / documenti) prima di toccarla: se non provata, si toglie (E8).
- `demos/puliziapro.html`: i 3 bottoni «Découvrir la Centralina» puntano a `/entreprises.html` con testo «Retour aux services» (#18).

---

## 4. Design system minimo

Un solo foglio: **`site/assets/services.css`** diventa il foglio comune di tutte le pagine (oggi lo usano 10 pagine; home e Ligne hanno stili inline). `audit-ui.css` resta per il widget chat/menu (già condiviso). `styles.css` non è usato da nessuna pagina: si archivia.

### 4.1 Colori (contrasti calcolati WCAG, 09.11)

| Token | Valore | Uso | Contrasto |
|---|---|---|---|
| `--bg` | `#F4F5F2` | fondo pagina (carta neutra, non crema) | — |
| `--surface` | `#E9EBE6` | card, blocchi | — |
| `--text` | `#1B1D1C` | testo | 15,5:1 su bg |
| `--muted` | `#55524C` | testo secondario | 7,1:1 su bg, 6,5:1 su surface |
| `--accent` | `#A33B1A` | link, etichette, bottoni pieni (testo bianco) | 6,0:1 su bg, 5,5:1 su surface, bianco su accent 6,6:1 |
| `--accent-deco` | `#C94F28` | SOLO superfici grandi/decorazioni senza testo | 4,1:1 → mai per testo |
| `--bg-dark` | `#1B1D1C` | fasce scure | — |
| `--text-inv` | `#F4F5F2` | testo su scuro | 15,5:1 |
| `--accent-inv` | `#F08A5D` | link su scuro | 6,9:1 |
| `--muted-inv` | `#B9BBB5` | secondario su scuro | 8,8:1 |
| `--focus` | `#1D5FA8` | anello di focus 2 px | 5,9:1 |

Ombre: una sola, neutra, `0 1px 3px rgba(0,0,0,.08)`; **niente glow colorato** (#9).

### 4.2 Tipografia (#25)
- Una famiglia: **Barlow** (testo, 400/500) + **Barlow Condensed** (titoli, 600/700). Via Cormorant Garamond, Instrument Serif, DM Sans.
- Font **ospitati sul sito** (`site/assets/fonts/*.woff2`, licenza OFL) invece di Google Fonts: niente IP dei visitatori mandati a Google (nLPD), una richiesta esterna in meno.
- Scala: corpo 17 px / 1.6; piccolo minimo 13 px; nessun testo funzionale < 12 px; H1 clamp(2rem, 5vw, 3.25rem); H2 1.6rem; H3 1.2rem.
- Paragrafi `max-width: 65ch` (#21).
- Corsivo: al massimo una frase per pagina. Niente etichetta maiuscola spaziata sopra H1/H2 (#10): se serve un contesto, va dentro il titolo.

### 4.3 Componenti (solo questi)
- `header` + `nav` comune: logo/nome, 4 voci (Mes essais, Apprendre l'IA, IA chez vous, Entreprises) + «Ligne» a destra; su mobile menu esistente di `audit-ui.css` (Escape, click esterno, focus già fatti il 30.10).
- `footer` comune: contatti, IG (`https://www.instagram.com/serafino.resout/`), FB (`https://www.facebook.com/profile.php?id=61596200613648`, da verificare in T22), mentions légales. Icone SVG inline con `aria-label`.
- `.hero-video`: `<video>` muto, `playsinline`, `controls`, `preload="none"`, `poster`, sottotitoli `<track kind="captions" srclang="fr">`; niente autoplay con audio. MP4 H.264 ≤ 6 MB ospitato sul sito (niente YouTube: cookie).
- `.door`: card porta (titolo, 1 riga, link su tutta la card, target ≥ 44 px).
- `.essai-card`: miniatura `loading="lazy"` con `alt`, titolo, `<time>`, testo, link esterno.
- `.format`: blocco formato (nome, durata, dove, prezzo, data, bottone iscrizione).
- `.btn` (pieno accent / contorno), focus visibile.
- Cache: link CSS/JS con `?v=20261109` (alzare a ogni deploy che cambia CSS/JS). HTML già `no-cache` lato nginx (STATO-SITO.md).

---

## 5. Task (ordinati; dentro la stessa fase sono indipendenti)

Legenda operai: **H** = operaio Haiku (meccanico), **C** = copywriter (testi, skill `voce-enrico` + `unslop`), **I** = ingegnere (redirect, nginx, deploy).
Tutto su branch `site/nuova-linea-2026-11`, worktree consigliato. Ogni task = un commit. Comando impeccable: `npx -y impeccable detect --json <file|url>` (da `site/`).
Abbreviazione: `PUB` = pagine pubbliche nuove = `index.html essais.html apprendre-ia.html ia-chez-vous.html entreprises.html reservations.html privacy.html`.

### Fase 0 — basi (prima di tutto)

**T01 · I · Fotografare il live nel repo (#4)**
File: `site/index.html`, `site/reservations.html`. Creare branch, verificare che la copia di lavoro sia uguale al live, commit «baseline live 09.11».
Accettazione: `diff <(curl -s https://serafino-resout.ch/) site/index.html` vuoto; idem `reservations.html`; `git status --short site/` vuoto.

**T02 · I · Deploy solo da commit**
File: `deploy.sh`. In testa: uscire con errore se `git status --porcelain site/` non è vuoto.
Accettazione: con un file `site/x.tmp` non committato `bash deploy.sh` esce ≠ 0 prima di rsync (provare con `DRY` / commentando rsync, mai deploy vero qui).

**T03 · H · Archiviare file morti (#24, #26, #27)**
`git mv site/{diagnostic,calculateur,centralina,cas-planeto}.html site/styles.css _archivio/site-2026-11/`.
Accettazione: `ls site/diagnostic.html site/calculateur.html site/centralina.html site/cas-planeto.html site/styles.css` → tutti «No such file»; `grep -rl 'styles.css' site --include=*.html` vuoto.

**T04 · H · Link rotti PuliziaPro e /app/demo (#18, #28)**
File: `site/demos/puliziapro.html`, `site/reservations.html`.
Accettazione: `grep -c 'centralina.html' site/demos/puliziapro.html` = 0; `grep -c '/app/demo' site/reservations.html` = 0; `grep -c 'href="/app"' site/reservations.html` ≥ 1.

### Fase 1 — design system

**T05 · H · Token e componenti in services.css (#8, #9, #21)**
File: `site/assets/services.css`. Sostituire `:root` con i token §4.1, ombra neutra, `p{max-width:65ch}`, classi §4.3 (`.door`, `.essai-card`, `.format`, `.hero-video`, `.btn`, focus).
Accettazione: `grep -ci 'C94F28' site/assets/services.css` = 1 (solo `--accent-deco`); `grep -ci 'F0EAE0' …` = 0; `grep -c 'max-width: *65ch' …` ≥ 1; `npx -y impeccable detect --json site/assets/services.css | grep -c '"cream-palette"\|"dark-glow"'` = 0.

**T06 · H · Font locali (nLPD, #25)**
File: `site/assets/fonts/` (Barlow 400/500, Barlow Condensed 600/700, woff2 dal repo ufficiale OFL), `@font-face` in `services.css`.
Accettazione: `ls site/assets/fonts/*.woff2 | wc -l` = 4; `grep -c '@font-face' site/assets/services.css` = 4; licenza `OFL.txt` presente in `site/assets/fonts/`.

**T07 · H · Header/nav/footer comuni (#2)**
File: snippet `docs/specs/partials-2026-11.html` (copia di riferimento, non servita) con header+footer §4.3; i task di pagina lo incollano. Verificare prima che l'URL FB risponda e sia la Pagina Serafino (`curl -sI`), altrimenti segnalarlo al capo.
Accettazione: il file contiene `instagram.com/serafino.resout`, `facebook.com/profile.php?id=61596200613648`, 4 voci nav + Ligne, `aria-label` sulle icone (grep).

### Fase 2 — pagine (per ognuna: H scheletro → C testi; pagine diverse in parallelo)

Gli scheletri usano solo componenti §4.3, header/footer di T07, `services.css?v=20261109`, nessun `<style>` inline, nessun Google Fonts, meta completi (title ≤ 60 car., description 120-155, canonical, og:title/description/image/url, JSON-LD BreadcrumbList), testi = segnaposto `{{T:nome-blocco}}`.
Accettazione comune scheletro: `grep -c '<style' f` = 0; `grep -c 'fonts.googleapis' f` = 0; `grep -c 'rel="canonical"' f` = 1; `grep -c 'og:image' f` = 1.
Accettazione comune testi (C): `grep -c '{{T:' f` = 0; `grep -c '—' f` = 0; `grep -oi 'sur mesure' f | wc -l` ≤ 1; nessuna frase «pas … mais» a specchio (`grep -Pi "pas [^.]{1,40}, mais"` vuoto); checklist finale `voce-enrico` e passata `unslop` riportate nel messaggio di ritorno; nessun nome di cliente (`grep -Ei 'planeto|moca|ruben|lapa|dge'` vuoto, salvo «demo» dichiarata).

**T08 · H · Scheletro `entreprises.html`** (partendo da `pme.html` con `git mv`, così resta la storia). Sezioni §3.5, ancora `#cas`. Accettazione comune + `grep -c 'id="cas"'` = 1.
**T09 · C · Testi `entreprises.html` (#11, #14)**. Fonte: testi delle 7 pagine vecchie (in `git show HEAD:site/<pagina>`) e i 2 casi anonimi della home. Accettazione comune testi + parole visibili tra 450 e 800.
**T10 · H · Scheletro `apprendre-ia.html`** (`git mv formation-ia.html`). 3 blocchi `.format`, link `mailto:contact@serafino-resout.ch?subject=…` uno per formato. Accettazione comune + `grep -c 'class="format' f` = 3; `grep -c 'mailto:contact@serafino-resout.ch' f` ≥ 3.
**T11 · C · Testi `apprendre-ia.html` (#3, #13)**. Prezzi e date: SOLO valori dati da Enrico (E1, E2), altrimenti «tarif sur demande» / «prochaine date sur Instagram». Accettazione comune testi + `grep -c 'CHF' f` = numero di prezzi approvati in E1 (0 se E1 aperta).
**T12 · H · Scheletro `ia-chez-vous.html`** (`git mv ia-locale-geneve.html`), sezione bot da `bot-personalise.html`. Accettazione comune.
**T13 · C · Testi `ia-chez-vous.html` (#16)**. Esperimento Omen vero (dati da memoria `omen_ollama_vps.md`, nessun IP/hostname). Accettazione comune testi + `grep -Ec '192\.168|hstgr|srv1587' f` = 0.
**T14 · H · Scheletro `essais.html`**: lista `.essai-card` con commento HTML che spiega come aggiungere una card. Accettazione comune + `grep -c 'class="essai-card' f` ≥ 2; ogni `<img` ha `alt=` e `loading="lazy"`; `grep -c 'instagram.com/embed\|connect.facebook.net' f` = 0.
**T15 · C · Testi `essais.html`**: 2-3 essais veri brevi. Accettazione comune testi.
**T16 · H · Scheletro home `index.html`** (#1, #17): §3.1, blocco `#qui` COPIATO identico dalla versione T01. Accettazione comune + `grep -c 'class="door' f` = 3; il blocco bio è identico a T01 (`diff` dell'estratto tra `id="qui"` e fine sezione vuoto); `<video` ha `playsinline`, `preload="none"`, `poster=`, `<track`.
**T17 · C · Testi home (#12)**: hero, porte, contatto. Bio e frase del nonno NON toccate. Accettazione comune testi + parole visibili ≤ 600 (`python3 -c` su testo estratto, comando riportato nel ritorno).
**T18 · H · Design Ligne `reservations.html` (#7, #25)**: via Instrument Serif/DM Sans e stili inline, header/footer comuni, testi ≥ 12 px. Accettazione: `grep -c '<style\|style="' f` = 0; `npx -y impeccable detect --json site/reservations.html` senza `low-contrast`, `tiny-text`, `overused-font`.
**T19 · C · Testi Ligne (#15)**: togliere trattini e drammi, fatti invariati. Piano 119 secondo E7. Accettazione comune testi + prezzo 249 presente (`grep -c '249' f` ≥ 1).
**T20 · H · Pagine minori (#18 già in T04, #23)**: header/footer comuni su `privacy.html` e `demos/puliziapro.html`; `og:image` in `enrico-la-noce/index.html`; privacy senza menzione Google Fonts. Accettazione: grep `og:image` = 1 in enrico-la-noce; `grep -c 'instagram.com/serafino.resout' privacy.html` ≥ 1.

### Fase 3 — tecnica e SEO

**T21 · I · Redirect e 410 (#11, #5, #6, #19)**
File: `deploy/nginx-redirects.conf` (tabella §2), `deploy.sh` (aggiungere a `RETIRED` le 10 pagine assorbite + cas-planeto). Sul VPS: backup di `nginx.conf`, riga `include`, `nginx -t`, reload. **Tocca produzione → solo con ok di Enrico (E9).**
Accettazione (dopo deploy): per ogni riga 301 della §2 `curl -sI https://serafino-resout.ch/<vecchio> | grep -E '^HTTP/.* 301|^location: .*<nuovo>'` = 2 righe; `curl -sI …/radar-pme/` → 410; nessuna catena: `curl -sIL -o /dev/null -w '%{num_redirects}'` = 1.

**T22 · H · Sitemap e robots (#29)**
File: `site/sitemap.xml` con 6 URL: `/`, `/essais.html`, `/apprendre-ia.html`, `/ia-chez-vous.html`, `/entreprises.html`, `/reservations.html`, `lastmod` = data deploy. `robots.txt` invariato.
Accettazione: `xmllint --noout site/sitemap.xml` ok; `grep -c '<loc>' site/sitemap.xml` = 6; nessun `<loc>` verso URL della colonna «vecchio».

**T23 · H · Link interni**
Tutti i link interni puntano ai nuovi URL (niente 301 interni).
Accettazione: `grep -rEn 'pme\.html|artisans\.html|horeca\.html|automatisation\.html|app-sur-mesure\.html|marketing-publicite-geneve\.html|geneve\.html|formation-ia\.html|ia-locale-geneve\.html|bot-personalise\.html|radar-pme|/guide/' site --include=*.html | grep -v '^site/moca/'` vuoto.

**T24 · H · Video hero (quando arriva il file, E3)**
`ffmpeg` → MP4 H.264 720p verticale ≤ 6 MB + poster JPG + sottotitoli VTT FR (Whisper sull'Omen, `-l fr`, rilettura del capo). File in `site/assets/video/`.
Accettazione: `ls -l` MP4 ≤ 6'291'456 byte; `ffprobe` codec h264; VTT valido (inizia con `WEBVTT`).

**T25 · I · Deploy e verifica completa (#30) — ok Enrico (E9)**
Merge del branch, `bash deploy.sh` da commit pulito, include nginx attivo.
Accettazione (tutte, regola `feedback_verifica_completa`):
- loop `curl -s -o /dev/null -w '%{http_code}'` su tutti gli URL 200 della §2 → tutti 200; tutti i 301/410 come T21;
- `curl -s <url> | grep -c 'v=20261109'` ≥ 1 su ogni pagina PUB;
- `npx -y impeccable detect --json <url>` e `--viewport 390x844 <url>` su ogni PUB: zero `low-contrast`, `tiny-text`, `cream-palette`, `dark-glow`, `hero-eyebrow-chip`, `kicker-above-heading`, `line-length`; salvare i JSON in `/tmp`-scratch e riportare il conteggio per pagina;
- Playwright sull'Omen, `iPhone 13`, `networkidle` + 3,5 s, ogni PUB: `document.documentElement.scrollWidth <= innerWidth`, menu si apre e chiude, screenshot salvati fuori dal repo;
- 0 errori console JS.

### Fase 4 — dopo il lancio (non bloccanti)
**T26 · I · Raccolta mail per la guida gratuita (E5)**: solo se Enrico decide; prima verificare `/api/lead-capture` con un invio di prova autorizzato, oppure usare l'invio mail già esistente sul VPS (`invia_mail_unica.py` è per invii, non per raccolta: serve decisione). Niente modulo finché non è verificato.

Conteggio: **H = 16** (T03-T08, T10, T12, T14, T16, T18, T20, T22-T24), **C = 6** (T09, T11, T13, T15, T17, T19), **I = 5** (T01, T02, T21, T25, T26).

---

## 6. Copertura dei 30 problemi

| # | Task | # | Task | # | Task |
|---|---|---|---|---|---|
| 1 | T16-T17 | 11 | T08-T09, T21 | 21 | T05 |
| 2 | T07, T16 | 12 | T17 | 22 | T19 + E7 |
| 3 | T10-T11 | 13 | T11 | 23 | T20 + E8 |
| 4 | T01-T02 | 14 | T09, T13 | 24 | T03 |
| 5 | T21 (410) | 15 | T19 | 25 | T05-T06, T18 |
| 6 | T21 (301), T26 | 16 | T12-T15 | 26 | T03 |
| 7 | T18 | 17 | T16-T17 | 27 | T03 |
| 8 | T05 | 18 | T04 | 28 | T04 |
| 9 | T05 | 19 | archiviata + 404 (T21 verifica) | 29 | T22 |
| 10 | T05, scheletri | 20 | T11, T13 + E1 | 30 | T25 |

---

## 7. Decisioni di Enrico (bloccano solo i task indicati)

| ID | Domanda | Blocca | Default se non risponde |
|---|---|---|---|
| E1 | Prezzi pubblici: webinar (gratis?), atelier (190-290 indicativo), lezione privata (120-150), IA privata installata (390-690). Mostrarli o «sur demande»? | T11, T13 | «tarif sur demande» |
| E2 | Date: primo webinar (giovedì sera?), primo atelier, luogo a Ginevra | T11 | «prochaine date sur Instagram» |
| E3 | Video hero: quale clip (dalle riprese 14-15.11) | T24, lancio home | poster statico con foto, video aggiunto dopo |
| E4 | Foto: Omen/scrivania per IA chez vous, miniature essais | T13, T15 | foto esistenti in `assets/photos/` |
| E5 | Raccolta mail (guida gratuita): sì/no, con quale strumento | T26 | nessun modulo, solo mailto |
| E6 | Frase sul carattere di Serafino in home (citazione breve in FR delle sue parole del 09.11) | T17 | niente citazione |
| E7 | Ligne: mostrare anche il piano 119 HT o solo 249? | T19 | come oggi (solo 249) |
| E8 | «Équivalence CFC reconnue par le SEFRI» sul CV: è provata? | T20 | si toglie la frase |
| E9 | Ok al deploy in produzione + modifica nginx sul VPS | T21, T25 | non si pubblica |

---

## 8. Rischi

- **SEO**: unire 10 pagine in 3 fa perdere posizioni per qualche settimana anche con 301; accettato perché oggi le pagine si fanno concorrenza (#11). Nessuna promessa di ranking.
- **Redirect già in cache** nei browser (il 28.10 c'erano 301 verso la home, poi tolti): nuove 301 verso pagine nuove li sovrascrivono; nessun loop possibile perché le destinazioni non sono mai redirette.
- **nginx sul VPS fuori dal repo**: l'include rende i redirect versionati, ma la riga `include` vive nel `nginx.conf` del container: va annotata in `STATO-SITO.md` e nella memoria.
- **Home senza video** se le riprese slittano: lancio comunque con poster (E3 default).
- **Testi**: i copioni social del 09.11 sono stati bocciati; per il sito vale lo stesso rischio. Ogni pagina C torna al capo e i testi passano da Enrico prima di T25.
- **Repo pubblico**: i testi non devono contenere nomi di clienti né prezzi non decisi; grep di T09-T19 e `gitleaks` prima del push.
- **Archivio parallelo** (radar, guide, festa, suggeritore): se l'altro operaio non ha finito, T21/T23 lo rilevano (grep/curl) e il capo coordina, non si cancella nulla di doppio.
