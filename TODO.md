# TODO — serafino-resout-site
## Aggiornato: 27 aprile 2026, sera

---

## PRIORITA IMMEDIATA (riprendere tra 5h)

### A. Fix FAB bot button — avatar mancante
**Problema**: index.html (VPS commit 48a3e66) usa `💬` emoji sul bottone floating.
Versione vecchia (commit 1af624e, righe 1766–1768) aveva avatar con immagine.

**CSS che manca nel merged index.html** (era in 1af624e, righe 963–978):
```css
.bot-fab-icon {
  width: 36px; height: 36px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
}
.bot-fab-icon img { width: 100%; height: 100%; object-fit: cover; }
.bot-fab-label { font-size: 13px; color: rgba(240,236,228,0.8); white-space: nowrap; }
```

**HTML che manca** (sostituire il `<button class="bot-fab">💬</button>` attuale):
```html
<button class="bot-fab" id="botFab" aria-label="Ouvrir l'assistant Serafino" aria-expanded="false">
  <span class="bot-fab-icon">
    <img src="./assets/photos/avatar.png" alt="Serafino" loading="lazy" onerror="this.src='./assets/photos/LA_NOCE_Enrico_v.jpg'" />
  </span>
</button>
```

**File da aggiornare** (VPS + tutte le pagine secondarie):
- `site/index.html` (VPS 48a3e66)
- `site/app-sur-mesure.html`
- `site/artisans.html`
- `site/automatisation.html`
- `site/bot-personalise.html`
- `site/diagnostic.html`
- `site/geneve.html`
- `site/horeca.html`
- `site/pme.html`

---

### B. Ripristinare mail feature nel bot
**Problema**: `serafino-bot.vercel.app` serve versione vecchia (543 righe, senza mail).
`git HEAD` ha la versione giusta (762 righe, con `prepareMail`).
**Working tree locale** `bot/bot.html` (526 righe) è modificato/degradato — NON committare.

**Piano**:
1. Ripristinare `bot/bot.html` da git HEAD: `git checkout HEAD -- bot/bot.html`
2. Verificare che la working tree ora abbia mail feature
3. Verificare che `bot/api/chat.js` abbia l'endpoint `prepareMail` funzionante
4. Commit + push → verificare se Vercel auto-deploya
5. Se Vercel non deploya → indagare (link branch? progetto diverso?)

**Come funziona la mail feature** (in git HEAD):
- Bottone "Préparer un mail" in `bot.html`
- Al click → chiama `/api/chat` con `{ action: 'prepareMail' }`
- API genera riassunto conversazione + mailto precompilato
- Bottone "Ouvrir le mail" → apre client mail con `contact@serafino-resout.ch`
- Copy disponibile in FR/EN/IT/DE

---

### C. Decisione: migrare bot da Vercel → VPS
**Stato attuale**: bot su `serafino-bot.vercel.app`, Vercel fuori sync con git
**Proposta**: Docker container su VPS + Traefik label → `bot.serafino-resout.ch`

**Pro VPS**:
- Nessun cold start (primo load iframe molto lento su Vercel free)
- Stessa infrastruttura Centralina (Traefik già attivo, HTTPS automatico)
- Deploy unico (scp/git sul VPS)
- Nessuna dipendenza piattaforma esterna per funzione critica sito

**Lavoro necessario**:
- Creare `docker-compose.yml` per bot (già ha `server.js` Express)
- Aggiungere Traefik labels per `bot.serafino-resout.ch`
- Aggiornare iframe src in tutte le pagine: `serafino-bot.vercel.app` → `bot.serafino-resout.ch`
- Env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` se usata, `PORT`

---

## PRIORITA 2 — Sync repo locale con VPS

**Problema**: VPS è avanti di 1 commit (48a3e66) rispetto al repo locale (1af624e).
Il merged index.html è stato pushato via `scp` direttamente sul VPS e committato lì.

**Fix**:
```bash
# Sul locale, pull dal VPS o cherry-pick il commit
git remote add vps root@serafino-resout.ch:/var/www/serafino-resout
git fetch vps && git merge vps/main
```
O più semplicemente: scaricare index.html aggiornato e committare localmente.

---

## PRIORITA 3 — Contenuti sito (backlog)

- [ ] `puliziapro.html` — verificare che corrisponda al nuovo cas réel in index.html
- [ ] `horeca.html` — è ancora placeholder/vecchio, manca case study Mensa DGE
- [ ] `cas-planeto.html` — decidere se mantenere o aggiornare (Planeto rimosso da homepage)
- [ ] `concept-homepage.html` — file non tracciato, eliminare o ignorare
- [ ] Pagine secondarie (artisans, pme, geneve) — verificare coerenza con nuovi prezzi Centralina

---

## STATO INFRASTRUTTURA

| Item | Dove | Stato |
|------|------|-------|
| serafino-resout.ch | VPS (Traefik + nginx Docker) | LIVE, HTTPS ✅ |
| Homepage index.html | VPS commit 48a3e66 | Swiss editorial + canvas ✅ |
| Bot iframe | serafino-bot.vercel.app | LIVE ma old, mail mancante ⚠️ |
| Bot mail feature | git HEAD bot/bot.html | Presente in git, non deployato ⚠️ |
| Avatar FAB button | Tutte le pagine | Mancante — emoji 💬 ⚠️ |
| Centralina | VPS porta 8091/8092/8093 | LIVE ✅ |
| puliziapro.html | VPS | LIVE (da verificare coerenza) |

---

## APPUNTO — Proposta Centralina (tempi reali)

- **Installazione**: 24 ore
- **Fixing/adattamento iniziale**: 2 settimane post-install
- **Accompagnamento autonomia**: 3 mesi — fix + adeguamento al flusso di lavoro reale del cliente
- **Filosofia**: non "garanzia bug" ma accompagnamento all'autonomia — il sistema si adatta al modo di lavorare vero del cliente, non il contrario

→ Da integrare in KB (10-centralina.md), business plan, sito (sezione méthode/garantie)
