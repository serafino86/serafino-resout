# TODO — serafino-resout-site
## Aggiornato: 28 aprile 2026

---

## STATO INFRASTRUTTURA

| Item | Dove | Stato |
|------|------|-------|
| serafino-resout.ch | VPS (Traefik + nginx Docker) | LIVE, HTTPS ✅ |
| Homepage index.html | VPS commit a0fd846 | Swiss editorial + canvas ✅ |
| Bot VPS | bot.serafino-resout.ch | LIVE, HTTPS, GPT-4o-mini ✅ |
| Bot mail feature | bot.html | Funzionante ✅ |
| Bot suggestion chips | bot.html | Fix curly quotes ✅ |
| Avatar FAB button | Tutte le pagine | ✅ |
| Iframe sito → bot | Tutte le pagine | bot.serafino-resout.ch ✅ |
| Centralina | VPS porta 8091/8092/8093 | LIVE ✅ |
| puliziapro.html | VPS | LIVE — da incorniciare come demo ⚠️ |
| centralina.html | — | DA CREARE 🔴 |
| app-sur-mesure.html | VPS | LIVE — prezzi sbagliati, casi sbagliati ⚠️ |

---

## PIANO OPERATIVO IN CORSO

### STEP 1 — FATTO ORA: `centralina.html` (pagina prodotto Centralina)

**Problema**: "Centralina → en savoir plus" su homepage punta a `app-sur-mesure.html`
che parla di app generiche, prezzi 1200 CHF, casi Planeto + piani alimentari.
Nessun link a demo, nessun flusso Centralina, nessuno screenshot.

**Soluzione**: creare `centralina.html` dedicata, aggiornare link su `index.html`.

**Struttura `centralina.html`**:
1. Hero — "La Centralina. La secrétaire silencieuse qui travaille 24/7."
2. Flusso concreto (cliente → devis 2min → planning → briefing mattutino → firma → Bexio)
3. Moduli inclusi (bot devis, scheduling, dashboard manager, Bexio)
4. Versioni + prezzi corretti (Standard 2500 / Pro 4500-6000 / Hosting 100/anno)
5. Accompagnamento: 24h install, 2 settimane fix, 3 mesi autonomia + rimborso
6. Sezione "Voir la démo en production" → link a puliziapro.html con numeri reali PuliziaPro
7. Placeholder screenshot (sostituire quando disponibili)
8. CTA: diagnostic gratuit

**Fix contestuale**:
- `index.html`: link "en savoir plus Centralina" → `./centralina.html`
- `app-sur-mesure.html`: lasciare per app custom generiche, correggere prezzi

### STEP 2 — `puliziapro.html`: aggiungere barra demo Centralina

Aggiungere banner top + sezione finale che la inquadra come demo del sistema,
non come sito di impresa di pulizie:

Banner top:
> "Démo — Système Centralina construit pour une entreprise de nettoyage genevoise.
>  Devis automatisé · Planning · Briefing équipe · Intégration Bexio.
>  [→ Découvrir la Centralina](./centralina.html)"

Sezione finale "Ce que cette démo illustre":
- Devis automatisé < 2 min (vs 15-20 min manuel)
- Planning sans conflits, zéro appels
- Briefing quotidien équipe sur Telegram
- Compta (Bexio) mise à jour à la signature
- Structure réplicable: artisans, HORECA, PME de services
- CTA → diagnostic gratuit

### STEP 3 — Contrasto/luminosità sito

Feedback: sito bello ma "poco luminoso".
- Verificare ratio contrasto WCAG AA (4.5:1 minimo) su testi muted
- Candidati: sezione hero testi secondari, label sezioni, footer
- Test su schermo non calibrato

### STEP 4 — Screenshot mancanti

Screenshot reali da catturare e caricare:
- Dashboard manager Centralina (PuliziaPro live)
- Conversazione bot Telegram devis flow
- Planning operatori con morning briefing
- Caricare in `assets/screenshots/`, collegare a `centralina.html` e `index.html`

---

## BACKLOG

- [x] `horeca.html` — case study Mensa DGE completo: before/after, narrativa, 5 screenshots, feature cards ✅
- [x] `app-sur-mesure.html` — prezzi corretti (Sur devis, 1500-4000 CHF) ✅
- [x] `cas-planeto.html` — mantenuto, contenuto completo ✅
- [x] `concept-homepage.html` — eliminato locale + VPS ✅
- [ ] Pagine (artisans, pme, geneve) — verificare coerenza prezzi Centralina
- [ ] Bot configurabile per cliente: client.yaml + wizard web UI (RIMANDATO)

---

## BOT — note tecniche

**Stack**:
- Primary: `openai/gpt-4o-mini` via OpenRouter (timeout 12s, ~$0.002/conv)
- Fallback 1: Gemini 2.5 Flash Lite (chiave diretta)
- Fallback 2: Groq llama-3.3-70b (chiave diretta)
- Fallback 3: `google/gemini-2.0-flash-001` via OpenRouter

**Bug risolti sessione 28/04**:
- Curly quotes Unicode nel JS bloccavano silenziosamente tutto → fix ASCII
- OpenRouter free (llama/nemotron) esponeva chain-of-thought → gpt-4o-mini paid
- Timeout 5s → 12s (gpt-4o-mini con KB ~5.2s)
- proactive_email non triggava (dipendeva da memory vuota) → ora 4 messaggi utente
- Pricing 09-chat-rules.md sbagliato (800 CHF) → 2500/4500-6000

---

## APPUNTO — Centralina tempi e garanzia

- Install: 24 ore
- Fix/adattamento: 2 settimane
- Accompagnamento autonomia: 3 mesi
- Garanzia: nessun risultato misurabile in 3 mesi → rimborso integrale
- Filosofia: il sistema si adatta al flusso reale, non il contrario
