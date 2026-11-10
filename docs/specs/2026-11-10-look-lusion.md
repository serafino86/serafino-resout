# SPEC v2 — Look del sito, ispirato a lusion.co (10.11.2026)

Autore: ingegnere (Marco Bernasconi). Stato: **DA APPROVARE**, niente implementato.
Sostituisce **§4 (design system)** e i task di design della spec `2026-11-09-sito-nuova-linea.md`. Di quella spec restano validi §1, §2 (URL), §3 (contenuti), §6, §7 (E1-E9), §8.
Origine: Enrico ha visto lusion.co e ha detto «a me piace un sito come questo».

⚠️ Repo PUBBLICO: qui niente prezzi, clienti, margini. Gli screenshot di lusion.co sono opere di terzi e **non stanno nel repo**: sono in `~/Sandbox/rif-lusion-2026-11-10/` (13 file JPEG, ~0,9 MB, solo riferimento interno).

---

## 1. Cosa ho visto (Chrome DevTools, 10.11.2026)

Viste: home a 1280×800 (hero, titolo grande, reel, lavori, sezione 3D, footer), `/about` a 1280, home e `/about` a 390×844 (emulazione iPhone), menu aperto su telefono. Misure lette dal DOM, non a occhio.

| Aspetto | Cosa fa Lusion |
|---|---|
| Palette | Fondo chiaro freddo quasi lavanda `rgb(240,241,250)`, testo nero, bottoni scuri `rgb(43,46,58)`, un blu elettrico `rgb(0,22,236)` come unico colore forte, footer bianco, fascia finale quasi nera `rgb(18,20,22)`. |
| Tipografia | Un solo grotesque geometrico (Aeonik, **commerciale**) a peso 400/500, più un mono per dettagli. Titoli enormi (fino a 128 px a 1280, 105 px a 390), interlinea ~1,1, testo 19 px. Etichette piccole in maiuscolo sotto le card. |
| Griglia | Margine 64 px a 1280, 15 px a 390. Due colonne di card su desktop, una su telefono. Piccole croci «+» come segni di griglia. |
| Angoli | Cornici 15 px, bottoni a pillola (100 px), cerchi. |
| Hero | Una frase a 32 px (non urlata) sopra una grande cornice arrotondata scura con una scena 3D viva. «Scroll to explore» sotto. |
| Scroll | **Finto**: `html` e `body` in `overflow: hidden`, la pagina (≈ 46'000 px in home) è mossa via JS con inerzia; le sezioni si agganciano alla scena 3D. Stessa cosa su telefono. |
| Movimento | La cornice hero cresce e diventa il reel a tutta larghezza; titoli che entrano; card che reagiscono al passaggio; un nastro 3D che attraversa la pagina; a fine pagina «continua a scorrere» porta alla pagina dopo. |
| Video / 3D | Un `<canvas>` WebGL fisso a tutto schermo sempre acceso, più video usati come texture. Reel su player esterno. |
| Menu | Pillola «Menu» in alto a destra; aperto: pannello a tutto schermo colorato con card arrotondate. |
| Cursore | `cursor: auto` sul body (nessun cursore sostituito a livello CSS); effetti al passaggio dentro la scena. |
| Footer | Fascia bianca con contatti e newsletter, poi fascia scura con il titolo della pagina successiva. |
| Peso | Un solo bundle JS di ~298 KB compressi, più font ~185 KB, più modelli e video da un secondo dominio (non misurabili da qui). Carica anche script di terzi (statistiche, player video). |
| Accessibilità | Titoli spezzati lettera per lettera e duplicati nell'albero di accessibilità («L L e e t t…»): un lettore di schermo li legge male. |

Non visto: vedi §10.

---

## 2. Cosa prendiamo e cosa no

**Prendiamo il linguaggio:**
1. Fondo chiaro **freddo** (grigio-azzurro), non carta né crema.
2. Tipografia **grande a peso normale**: la gerarchia la fa la dimensione, non il grassetto.
3. **Cornici arrotondate** che contengono video o foto: sono l'unico «oggetto» della pagina.
4. Molto vuoto, poche cose per schermata, una colonna di testo stretta accanto a un titolo largo.
5. **Movimento legato allo scroll**: le cornici crescono entrando, i titoli salgono.
6. Bottoni a pillola, un solo colore forte.
7. Fine pagina che invita alla pagina dopo.

**NON prendiamo:**
- Lo scroll finto. Lo scroll resta quello del browser (accessibilità, tasto indietro, ricerca nella pagina, telefoni lenti).
- La scena WebGL sempre accesa e il bundle da 300 KB (vedi §5.1).
- Le croci «+», il nastro 3D, la cornice scura con oggetti 3D, il pannello menu blu a tutto schermo, il «continua a scorrere per cambiare pagina»: sono la firma di Lusion.
- Il blu elettrico: il nostro colore forte resta l'arancio di Serafino.
- Titoli spezzati lettera per lettera, etichette maiuscole spaziate (vietate già dalla spec 09.11, #10).
- Script di terzi, player esterni, font commerciali.

**Regola «ispirazione, non copia»** (vale per ogni task): nessuna riga di codice, nessun asset, font, testo, logo, modello 3D o composizione identica presi da lusion.co. Chi implementa lavora da questa spec, non dal loro sorgente. La nostra home ha un'altra composizione: testo a sinistra, cornice **verticale** con Enrico a destra (§6).

---

## 3. Design system (sostituisce §4 della spec 09.11)

Fogli: `site/assets/services.css` (tutto lo statico), nuovo `site/assets/motion.css` (solo movimento, §5), `audit-ui.css` (chat e menu mobile, invariato salvo colori). I **nomi** dei token e delle classi già usati negli scheletri restano (`--bg`, `.door`, `.essai-card`, `.format`, `.hero-video`, `.btn`): cambiano i valori, così gli HTML si toccano poco.

### 3.1 Colori (contrasti WCAG 2.x calcolati il 10.11 con la formula della luminanza relativa)

| Token | Valore | Uso | Contrasto |
|---|---|---|---|
| `--bg` | `#EEF0F4` | fondo pagina (grigio freddo) | — |
| `--surface` | `#E1E4EA` | blocchi, campi, pillole chiare | — |
| `--white` | `#FFFFFF` | card e footer chiaro | — |
| `--text` | `#14161A` | testo, titoli | 15,87 su bg · 14,22 su surface · 18,11 su white |
| `--muted` | `#4B515C` | testo secondario | 7,00 su bg · 6,27 su surface · 7,98 su white |
| `--accent` | `#A33B1A` | link, bottone pieno (testo bianco) | 5,76 su bg · 5,16 su surface · 6,57 su white · bianco su accent 6,57 |
| `--accent-deco` | `#E0572B` | SOLO forme grandi senza testo (punto, sottolineatura, fondo di una cornice vuota) | 3,31 su bg → **mai testo** |
| `--bg-dark` | `#14161A` | fascia finale, bottone scuro | — |
| `--text-inv` | `#EEF0F4` | testo su scuro | 15,87 |
| `--muted-inv` | `#B4B9C4` | secondario su scuro | 9,21 |
| `--accent-inv` | `#FF9A70` | link su scuro | 8,72 |
| `--focus` | `#1D4ED8` | anello di focus 2 px + offset 2 px | 5,87 su bg · 5,26 su surface · 6,70 su white |

Su fondo scuro l'anello di focus usa `--text-inv`. Ombre: nessuna sulle cornici (il raggio basta); una sola neutra `0 1px 3px rgba(0,0,0,.08)` per il menu aperto. Niente glow, niente gradienti decorativi.

Perché l'arancio resta: è il marchio (cucina, calore), regge il contrasto, e su fondo freddo dà lo stesso «un colore solo che salta» senza assomigliare a Lusion.

### 3.2 Tipografia

**Decisione: resta Barlow (OFL), una sola famiglia, due file: 400 e 500. Barlow Condensed esce.**
Motivo: l'effetto visto viene da un grotesque largo a peso normale usato grande; Barlow 400/500 lo regge, è già in locale con licenza, e togliere il Condensed leva due file (≈ 45 KB) e il tono «insegna stradale» dei titoli stretti in grassetto, che è l'opposto di quel che è piaciuto a Enrico. Nessun font nuovo da scaricare.
Ripiego già scelto se alla prima prova (T33) i titoli risultano deboli: Hanken Grotesk (OFL), stessi due pesi, si cambia solo `--font-d`. Decide l'ingegnere sullo screenshot, non è una domanda per Enrico.

| Ruolo | Valore |
|---|---|
| `--font-d` e `--font-b` | `'Barlow', system-ui, sans-serif` |
| Display (H1) | `clamp(2.5rem, 8vw, 7rem)`, peso 500, interlinea 1,02, `letter-spacing: -0.02em` |
| H2 | `clamp(2rem, 5.5vw, 4.5rem)`, peso 500, interlinea 1,05, `-0.015em` |
| H3 | `clamp(1.25rem, 2vw, 1.75rem)`, peso 500, interlinea 1,2 |
| Lead | `clamp(1.25rem, 2vw, 1.75rem)`, peso 400, interlinea 1,3 |
| Corpo | 17 px / 1,6, peso 400, `max-width: 65ch` |
| Piccolo | 14 px; etichetta sotto card 13 px, **minuscolo**, colore `--muted` |

Regole: nessun testo < 13 px; nessun maiuscolo spaziato; niente corsivo decorativo; `overflow-wrap: break-word` sui titoli (parole francesi lunghe a 390 px); `text-wrap: balance` su H1/H2. Si precaricano solo i due woff2 (`rel="preload"`), `font-display: swap`.
Vincolo per il copywriter (T17 ecc.): H1 ≤ 45 caratteri, riga delle porte ≤ 60.

### 3.3 Raggi, spazi, griglia

| Token | Valore |
|---|---|
| `--r-frame` | `clamp(14px, 2vw, 24px)` (cornici, card, menu) |
| `--r-sm` | `10px` (campi, miniature piccole) |
| `--r-pill` | `999px` (bottoni, voci di nav) |
| `--margin` | `clamp(16px, 5vw, 72px)` (margine pagina) |
| `--gutter` | `clamp(16px, 2vw, 24px)` |
| Scala spazi | 4 · 8 · 16 · 24 · 40 · 64 · 96 · 160 px (`--s1`…`--s8`) |
| Sezione | `padding-block: clamp(64px, 12vw, 160px)` |
| Griglia | 12 colonne ≥ 900 px, 1 colonna sotto; larghezza massima contenuto 1440 px |

### 3.4 Componenti

- **Header**: nome «Serafino» a sinistra; a destra le 4 voci in una barra a pillola `--surface` + «Ligne» come pillola scura. Le voci restano **link visibili** su desktop (non un menu nascosto: meglio per chi arriva e per i motori). Sotto 900 px: bottone menu a pillola (≥ 44 px) che apre il pannello esistente di `audit-ui.css`, ridisegnato come card bianca arrotondata su fondo `--bg`. Header `position: sticky`, fondo `--bg` pieno (niente sfocatura).
- **`.frame`**: contenitore arrotondato `--r-frame`, `overflow: hidden`, `aspect-ratio` dichiarato (`--ar`), fondo `--surface` finché l'immagine carica. Dentro: `<img>` o `<video>` con `object-fit: cover`, sempre `width`/`height` nell'HTML.
- **`.hero`**: due colonne ≥ 900 px (testo 7/12, cornice 5/12), una sotto. Dettagli §6.
- **`.door`** (3 porte): card bianca `--r-frame`, titolo H3 grande, una riga, freccia in un cerchio; tutta la card è il link; al passaggio/focus il cerchio diventa `--accent`.
- **`.essai-card`**: `.frame` 9:16 + etichetta 13 px + titolo H3 + 2-3 righe + link. Dettagli §7.
- **`.format`**: card bianca, nome in H3, righe «durata / dove / data» in lista di definizione, bottone.
- **`.btn`**: pillola. Pieno scuro (`--bg-dark`/`--text-inv`) come principale; `--accent` solo per l'azione finale della pagina; contorno per il secondario. Altezza ≥ 44 px.
- **`.next-door`**: ultima fascia prima del footer, scura, con angoli alti arrotondati: «pagina dopo» come titolo H2 cliccabile + freccia. È un link normale, non parte da solo.
- **Footer**: fascia bianca, contatti grandi (telefono e mail a dimensione lead), IG, FB, mentions légales.
- Cursore: quello del sistema, sempre. `cursor: pointer` solo su link e bottoni.

Da togliere da `services.css` mentre lo si riscrive: i blocchi `opacity: 0; animation: slideIn … forwards` (oggi il testo nasce invisibile e dipende dall'animazione) e `kenBurns`.

---

## 4. Budget (vincoli misurabili)

| Voce | Limite |
|---|---|
| JS nostro per pagina (escluso il widget chat della home) | ≤ 8 KB non compressi in totale (`site-ui.js` 3 KB + `motion.js` ≤ 4 KB) |
| Librerie JS | **zero**. Nessuna dipendenza npm nuova, nessun CDN |
| CSS | `services.css` ≤ 40 KB, `motion.css` ≤ 6 KB |
| Font | 2 file woff2 (≈ 44 KB) |
| Poster hero | ≤ 80 KB, è l'elemento LCP: `fetchpriority="high"`, non lazy |
| Home senza video | ≤ 400 KB trasferiti |
| LCP su telefono (Lighthouse mobile, 4G lento, CPU ×4) | ≤ 2,5 s |
| CLS | ≤ 0,05 |
| Lighthouse | prestazioni ≥ 90, accessibilità ≥ 95 su tutte le pagine pubbliche |
| Richieste a terzi | 0 (come oggi: nLPD) |

Sempre veri: sito **leggibile senza JS** e senza `motion.css` (nessun contenuto parte nascosto); `prefers-reduced-motion: reduce` → zero animazioni e nessun video che parte da solo; tutto raggiungibile da tastiera con focus visibile; nessuno scroll orizzontale a 390 px.

---

## 5. Movimento

### 5.1 Decisione: solo CSS + poco JS. Niente WebGL, niente three.js.

Motivi:
1. Quello che colpisce in quel sito (cornici che crescono, titoli grandi, ritmo) si ottiene con CSS. La scena 3D è il loro mestiere, non il nostro messaggio.
2. Nel nostro hero deve esserci **Enrico che parla**. Una scena 3D gli farebbe concorrenza.
3. three.js pesa ≈ 170 KB compressi (licenza MIT, si potrebbe tenere in locale): da solo è 20 volte tutto il nostro budget JS e mette a rischio l'LCP sui telefoni di chi arriva da Instagram.
4. Va mantenuto da una persona sola.

Se Enrico la vuole comunque (decisione E11, default NO): una sola scena nell'hero, three.js in locale in `site/assets/vendor/`, caricata con `import()` dopo `load` e solo se schermo ≥ 900 px, niente `reduced-motion`, niente `Save-Data`; il poster resta sotto come ripiego. Sarebbe una fase a parte, fuori da questi task.

### 5.2 Tecniche

| Effetto | Tecnica | Dove non c'è supporto |
|---|---|---|
| Cornici che entrano crescendo (scala 0,92 → 1, raggio più largo → `--r-frame`) | CSS scroll-driven: `animation-timeline: view()` | la cornice è già a misura piena, ferma |
| Cornice hero che si allarga mentre si scende | `animation-timeline: scroll()` sul primo schermo | resta com'è |
| Titoli H2 che salgono di 24 px entrando | `animation-timeline: view()`, solo `transform` | titolo fermo e visibile |
| Passaggio fra pagine (dissolvenza 200 ms, la cornice della porta «diventa» l'hero della pagina) | View Transitions fra documenti: `@view-transition { navigation: auto }` + `view-transition-name` | cambio pagina normale |
| Porte e card al passaggio/focus | `transition` su `transform` e colore, 200 ms | — |
| Video che parte quando è visibile e si ferma quando esce | `motion.js`, `IntersectionObserver` | video con `controls`, parte al tocco |

Regole di scrittura:
- Tutto `motion.css` sta dentro `@supports (animation-timeline: view())` (tranne View Transitions e hover) ed è caricato con `<link media="(prefers-reduced-motion: no-preference)">`: chi chiede meno movimento non lo scarica nemmeno.
- Si anima solo `transform`, `opacity` (mai da 0: minimo 0,6 e solo dentro `@supports`), `border-radius`, `clip-path`. Mai `width`, `height`, `top`, `margin`.
- Nessun `scroll-snap`, nessun `overflow: hidden` su `html`/`body`, nessun listener `wheel` o `touchmove`, nessun `scroll-behavior` forzato.
- Nessun ripiego JS per i browser senza scroll-driven: lì il sito è fermo e completo. (Supporto: Chrome/Edge sì, Safari recenti sì; Firefox **da verificare in T38** con la versione del giorno.)

### 5.3 `motion.js` (≤ 4 KB, vanilla, `defer`)
Fa solo tre cose: (1) fa partire/fermare i video `data-autoplay` quando entrano/escono dallo schermo, ma **non** se `prefers-reduced-motion` o `navigator.connection.saveData`; (2) bottone pausa/riprendi sempre visibile sulla cornice (WCAG 2.2.2); (3) bottone «Voir avec le son» dell'hero: sostituisce l'anteprima muta con il video intero, con `controls` e sottotitoli. Nell'HTML il `<video>` ha `controls` e **non** ha l'attributo `autoplay`: è lo script a toglierli/avviare. Senza JS resta un video normale con poster.

---

## 6. Hero della home: il posto per il video di Enrico

- Composizione: a sinistra H1 + una riga lead + bottoni IG/FB; a destra **cornice verticale 4:5** (≥ 900 px, alta al massimo 80 % dello schermo) con Enrico. Su telefono: titolo, poi cornice 4:5 a tutta larghezza. Il video è girato in verticale: la cornice lo taglia al centro (`object-fit: cover`), niente bande.
- **Oggi (clip non ancora girata)**: nella cornice un poster statico `site/assets/video/hero-poster.jpg` (800×1000, ≤ 80 KB) ricavato da `assets/photos/enrico_hero.jpg`. Niente bottone video finché il file non c'è.
- **Quando arriva la clip** (T40): 
  - anteprima `hero-teaser.mp4`: 6-8 s, muta, in loop, 720×900, H.264, ≤ 1,5 MB, `preload="none"`, parte solo se visibile (§5.3);
  - video intero `hero.mp4`: ≤ 6 MB, con audio, caricato solo al tocco di «Voir avec le son», `<track kind="captions" srclang="fr">`;
  - il poster resta l'elemento LCP in ogni caso.
- Nessun autoplay con audio, mai. Nessun player esterno.

## 7. «Mes essais»: il posto per i Reel

- Griglia di `.essai-card`: 3 colonne ≥ 1100 px, 2 ≥ 600 px, 1 sotto. La prima card (l'ultimo essai) è larga il doppio su desktop.
- Ogni card: cornice **9:16** con il poster del Reel (`site/assets/essais/AAAA-MM-GG-nome.jpg`, 540×960, ≤ 60 KB, `loading="lazy"`, `alt` che descrive la scena), un cerchio «play» disegnato in CSS, etichetta 13 px (data · durata), titolo, 2-3 righe, link «Voir le Reel sur Instagram».
- Il link porta su Instagram/Facebook. **Nessun embed Meta** (confermata la scelta nLPD della spec 09.11) e nessuno script loro.
- La stessa card, presa tale e quale, è l'«ultimo essai» in home.
- Non previsto ora (da non costruire): anteprima video locale dentro la card. Se servirà, la cornice è già pronta a ospitare un `<video data-autoplay muted>` come l'hero.
- Manutenzione invariata: un blocco HTML da copiare per ogni nuovo essai, istruzioni in commento.

---

## 8. Task

Operai: **H** = operaio leggero (meccanico), **E** = esperto (CSS/JS di giudizio), **I** = ingegnere. Ogni task = un commit sul ramo `feat/sito-nuova-linea`. `V` = `python3 docs/specs/verifica.py`. `PAG` = `site/index.html site/essais.html site/apprendre-ia.html site/ia-chez-vous.html site/entreprises.html`. Versione cache nuova: `?v=20261110`.

| # | Chi | Cosa | File | Accettazione | Dipende da / parallelo |
|---|---|---|---|---|---|
| **T30** | I | Chiudere le modifiche non committate del 09.11 (`services.css`, `reservations.html`, `privacy.html`, `enrico-la-noce/index.html`): commit o scarto deciso dal capo, prima che qualcuno tocchi `services.css` | i 4 file | `git status --short site/` vuoto | primo, blocca T31, T33, T42 |
| **T31** | H | Token v2 (§3.1-3.3) in `:root`; via i due `@font-face` Condensed e i due file; `--font-d` = Barlow | `site/assets/services.css`, `site/assets/fonts/` | `ls site/assets/fonts/*.woff2 \| wc -l` = 2; `grep -ci condensed services.css` = 0; `grep -c 'EEF0F4' services.css` ≥ 1; `V --css site/assets/services.css` OK (contrasti) | dopo T30; ∥ T32 |
| **T32** | E | `verifica.py` v2 (§9) con auto-prova | `docs/specs/verifica.py` | `V --autoprova` esce 0 (i casi sbagliati incorporati falliscono come previsto); `V PAG` gira senza eccezioni | ∥ T31 |
| **T33** | E | Statico: griglia, header a pillola, `.frame`, `.hero`, `.door`, `.essai-card`, `.format`, `.btn`, `.next-door`, footer; via `slideIn`/`kenBurns` e ogni `opacity: 0` iniziale; `services.css` ≤ 40 KB. Prova titoli Barlow su screenshot: se deboli, passare a Hanken Grotesk (§3.2) e scriverlo nel ritorno | `site/assets/services.css`, `audit-ui.css` (solo colori/raggi menu) | `V --css` OK; `grep -c 'opacity: *0' services.css` = 0; `wc -c` ≤ 40960; screenshot 390 e 1280 di PAG salvati fuori repo; a 390 `scrollWidth <= innerWidth` su PAG; `npx -y impeccable detect` senza `low-contrast`, `tiny-text` | dopo T31 |
| **T34** | H | Header/footer v2 + `.next-door` nel partial, poi incollati nelle 5 pagine; link CSS/JS a `?v=20261110`; `preload` dei 2 font | `docs/specs/partials-2026-11.html`, PAG | `V PAG` OK; in ogni pagina `grep -c 'class="next-door'` = 1 e `grep -c 'rel="preload"'` = 2 | dopo T32; ∥ T33 |
| **T35** | H | Hero home a due colonne con `.frame` 4:5 e poster; poster generato da `enrico_hero.jpg` (`ffmpeg`/`cwebp` già presenti, niente strumenti nuovi) | `site/index.html`, `site/assets/video/hero-poster.jpg` | poster ≤ 81'920 byte; `<img` del poster ha `width`, `height`, `fetchpriority="high"`, niente `loading="lazy"`; blocco `#qui` identico a prima (`git diff` non lo tocca); `V site/index.html` OK | dopo T34; ∥ T36, T37 |
| **T36** | H | Card essais con cornice 9:16, etichetta, cerchio play; prima card doppia; stessa card in home | `site/essais.html`, `site/index.html` (solo blocco ultimo essai) | `grep -c 'class="essai-card'` ≥ 2; ogni `<img` ha `alt`, `width`, `height`, `loading="lazy"`; nessun `instagram.com/embed` né `connect.facebook.net`; `V` OK | dopo T34; ∥ T35 (file diverso: fare l'home per ultima), T37 |
| **T37** | H | Cornici e card nelle altre tre pagine (foto in `.frame`, `.format` come card) | `apprendre-ia.html`, `ia-chez-vous.html`, `entreprises.html` | `V` OK sulle 3; `grep -c 'class="format'` = 3 in apprendre-ia | dopo T34; ∥ T35, T36 |
| **T38** | E | `motion.css` (§5.2) + riga `<link media=…>` nelle 5 pagine; View Transitions; verificare il supporto reale di Firefox e scriverlo nel ritorno | `site/assets/motion.css`, PAG | ≤ 6'144 byte; `V --css site/assets/motion.css` OK (regole §9); in Chrome dopo uno scroll `document.getAnimations().length` > 0; con `reduced-motion` emulato = 0; con `motion.css` bloccato la pagina è identica e completa | dopo T33 e T35-T37; ∥ T39 |
| **T39** | E | `motion.js` (§5.3) | `site/assets/motion.js`, `site/index.html` (tag script) | ≤ 4'096 byte; nessun `import`/CDN; con JS spento il video ha `controls`; con `reduced-motion` o `saveData` nessun `play()`; pausa raggiungibile con Tab e attivabile con Invio/Spazio; 0 errori console | dopo T35; ∥ T38 |
| **T40** | H | Video hero quando arriva la clip (**sostituisce T24**): teaser, video intero, VTT (Whisper sull'Omen, riletto dal capo) | `site/assets/video/` , `site/index.html` | teaser ≤ 1'572'864 byte e senza traccia audio (`ffprobe`); intero ≤ 6'291'456 byte, h264; VTT inizia con `WEBVTT`; `V` OK | dopo T39 e E3 |
| **T41** | H | Poster dei Reel per ogni essai (fotogramma scelto, 540×960) | `site/assets/essais/`, `site/essais.html` | ogni file ≤ 61'440 byte; nessun `{{T:` negli `alt` dopo T15 | dopo T36 e E4 |
| **T42** | H | Ligne, privacy, PuliziaPro sul nuovo look (**sostituisce la parte grafica di T18 e T20**) | `reservations.html`, `privacy.html`, `demos/puliziapro.html` | `grep -c '<style\|style="'` = 0 su reservations; `V` OK; nessun font oltre Barlow | dopo T30, T33; ∥ T38, T39 |
| **T43** | I | Verifica locale completa prima dei testi e del deploy: server locale, Lighthouse mobile su tutte le pagine, JS spento, movimento ridotto, tastiera, 390/1280; tabella dei risultati al capo e screenshot a Enrico | nessuno (solo report) | budget §4 rispettato su ogni pagina, numeri riportati; se LCP > 2,5 s si alleggerisce prima di andare avanti | ultimo |

**14 task**: H = 8 (T31, T34-T37, T40-T42), E = 4 (T32, T33, T38, T39), I = 2 (T30, T43).
Ordine: T30 → (T31 ∥ T32) → (T33 ∥ T34) → (T35 ∥ T36 ∥ T37) → (T38 ∥ T39 ∥ T42) → T43. T40 e T41 quando arrivano clip e foto.

### 8.1 Task della spec 09.11

| Task | Stato |
|---|---|
| T01-T04, T21 (preparato), T22 | fatti, **restano** |
| T05 (token) | fatto, **superato da T31** (stessi nomi, valori nuovi) |
| T06 (font) | fatto, **cambia**: T31 toglie il Condensed, Barlow resta |
| T07 (partial) | fatto, **cambia** con T34 |
| T08, T10, T12, T14, T16 (scheletri) | fatti, **restano**; ritocchi in T35-T37 |
| T09, T11, T13 (testi entreprises, apprendre-ia, ia-chez-vous) | fatti il 10.11, **restano**: T34 e T37 cambiano solo struttura e classi, il testo non si tocca (accettazione in più per T34/T37: `V --testi` ancora OK e conteggio parole di `<main>` invariato). Se un H1 supera i 45 caratteri di §3.2 lo segnala l'operaio, lo accorcia il copywriter |
| T15, T17 (testi essais e home) | in scrittura il 10.11, **restano**; T35 e T36 partono solo quando sono committati (stessi file) |
| T19 (testi Ligne) | **resta**, dopo T42 |
| T18 (design Ligne) | **cade**, sostituito da T42 |
| T20 | **resta** solo `og:image` e testo privacy; la parte grafica passa a T42 |
| T23 (link interni) | **resta** |
| T24 (video hero) | **cade**, sostituito da T40 |
| T25 (deploy) | **resta**, con `v=20261110` e dopo T43; sempre con ok di Enrico (E9) |
| T26 | **resta** (dopo il lancio) |

---

## 9. Aggiornamenti a `verifica.py` (T32)

1. Versione cache in una costante `VERSIONE = "20261110"` (oggi è scritta a mano come `20261109`); controllo anche su `motion.css` e `motion.js` dove presenti.
2. Ogni `<img>`: `width` e `height` (oltre ad `alt`).
3. Ogni `<video>`: `playsinline`, `preload="none"`, `poster=`, `controls`; **nessun** attributo `autoplay`; `<track kind="captions"` se il video non è `muted`.
4. Nessuna risorsa da altri domini: `src`/`href` di `script`, `link`, `img`, `video`, `source`, `track` non iniziano con `http` né `//` (i link `<a>` esterni restano liberi).
5. Ogni `<script src>` ha `defer` o `type="module"`; somma dei byte degli script locali referenziati ≤ 8'192 (escluso l'elenco `ESCLUSI` per il widget chat).
6. `<link … motion.css>` ha `media="(prefers-reduced-motion: no-preference)"`.
7. Modo `--css FILE`:
   - legge i token da `:root` e ricalcola i contrasti delle coppie di §3.1; fallisce sotto 4,5 (3,0 per `--focus`); `--accent-deco` non deve comparire in nessuna dichiarazione `color:`;
   - vietati: `cursor: none`, `cursor: url(`, `scroll-snap`, `@import`, `url(http`, `overflow: hidden` in regole su `html`/`body`;
   - in `services.css`: nessun `opacity: 0`, nessun `animation-timeline`;
   - in `motion.css`: ogni `animation-timeline` dentro un blocco `@supports (animation-timeline`; nessuna proprietà animata fuori da `transform`, `opacity`, `border-radius`, `clip-path`;
   - peso: `services.css` ≤ 40'960, `motion.css` ≤ 6'144 byte.
8. `--autoprova`: 4-5 frammenti sbagliati incorporati (video con `autoplay`, script da CDN, contrasto 3:1, `cursor: none`) che devono fallire: è il test del verificatore.

Fuori da `verifica.py` (si provano nel browser in T38, T39, T43): animazioni attive/spente, JS spento, Lighthouse, tastiera. Restano i controlli attuali (canonical, og:image, title, description, breadcrumb, testi).

---

## 10. Rischi

- **Aspettativa**: Enrico ha visto un sito fatto di 3D in tempo reale. Noi ne prendiamo il linguaggio, non lo spettacolo. Va detto prima, con due screenshot dopo T33/T35, non a lavoro finito.
- **Telefoni vecchi**: le animazioni legate allo scroll girano fuori dal thread principale e toccano solo `transform`; dove non sono supportate non c'è nulla da calcolare. Il rischio vero è il video: per questo anteprima ≤ 1,5 MB, `preload="none"`, niente avvio con `Save-Data`.
- **Supporto browser disuguale**: su Firefox e sugli iPhone non aggiornati il sito può risultare fermo (ma completo). Accettato: nessun ripiego JS.
- **SEO**: nessun impatto negativo atteso (HTML tutto nel sorgente, nav con link veri, niente contenuto dietro JS). I titoli enormi restano H1/H2 veri, non immagini. L'LCP è il poster: se supera 80 KB il punteggio scende.
- **Titoli grandi in francese**: parole lunghe a 390 px possono andare a capo male; limiti di lunghezza ai testi e controllo dello scroll orizzontale in T33/T43.
- **Tempo**: T33 è il task grosso (un file, un esperto, non si divide senza conflitti). Stima realistica dell'insieme: 1-2 giorni di operai più le verifiche; T40/T41 dipendono dalle riprese.
- **File a metà del 09.11**: finché T30 non è chiuso, ogni lavoro su `services.css` rischia di mescolarsi a modifiche non committate.
- **Somiglianza**: stesso fondo chiaro + cornici arrotondate è un linguaggio diffuso; restiamo distinti per colore, composizione dell'hero, font e assenza dei loro segni (§2). Chi implementa non apre il loro sorgente.

### Cosa non ho potuto vedere di lusion.co
Il sito su un telefono vero (solo emulazione 390 px su desktop: prestazioni e gesto touch reali non misurati); il comportamento con `prefers-reduced-motion`; gli effetti al passaggio del mouse e l'eventuale cursore disegnato dentro la scena 3D; le pagine `/projects` e le schede progetto; il reel in riproduzione; l'animazione d'ingresso al caricamento; il peso di modelli e video serviti dal secondo dominio; un punteggio Lighthouse. Lo scroll è stato simulato con eventi sintetici: il ritmo l'ho visto a fotogrammi, non in continuo.

---

## 11. Decisioni di Enrico

| ID | Domanda | Blocca | Default se non risponde |
|---|---|---|---|
| E10 | Colore forte: resta l'arancio di Serafino su fondo freddo, o si passa a un altro colore? | T31 | resta l'arancio |
| E11 | Scena 3D animata nell'hero (come Lusion) oltre al video? Costa peso e manutenzione (§5.1) | fase a parte | NO: nell'hero c'è Enrico |
| E12 | Riprese del 14-15.11: girare anche 6-8 secondi **senza parlare** (un gesto, uno sguardo) per l'anteprima muta in loop | T40 | l'anteprima si taglia dalla clip parlata, senza audio |

Le scelte tecniche (font, tecnica del movimento, niente librerie, budget) sono dell'ingegnere e sono già prese qui sopra.
