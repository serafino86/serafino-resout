# Serafino Resout Site — Claude Instructions

## Progetto
Due cose distinte in questo repo:
1. **Sito statico** (`site/`) — sito marketing Serafino Resout (Ginevra, PMI servizi)
2. **Radar PME** — bot Telegram + invio newsletter per abbonati radar (⚠️ DISTINTO da Radar Centralina)

## ⚠️ GUARDRAIL CRITICO
**Radar PME** (newsletter clienti PMI) ≠ **Radar Centralina** (tool interno Enrico/Blasco).
NON mescolare mai le due logiche.

## Stack
- Sito: HTML/CSS/JS statico (`site/`)
- Radar bot: Python + `python-telegram-bot` (`opt_radar_bot.py`)
- Radar invio: Python (`opt_radar_send.py`)
- Hosting sito: CNAME → dominio Serafino

## File principali
- `site/index.html` — homepage
- `site/geneve.html`, `site/pme.html` — landing page target
- `site/radar-pme/` — pagine radar
- `site/calculateur.html` — calcolatore ROI
- `opt_radar_bot.py` — bot Telegram abbonati radar
- `opt_radar_send.py` — invio radar quotidiano
- `bot/` — logica bot aggiuntiva
- `deploy.sh` — deploy sito

## Variabili ambiente Radar
- `RADAR_BOT_TOKEN` — token Telegram bot
- `RADAR_DB_PATH` — path SQLite abbonati (default `/opt/radar/subscribers.db`)
- `RADAR_ADMIN_CHAT_ID` — chat ID admin (default: 1406623469)

## Deploy sito
```bash
bash deploy.sh
```

## Pagine principali del sito
- `index.html` — homepage Serafino
- `geneve.html` — landing Ginevra
- `artisans.html`, `horeca.html` — verticali settore
- `app-sur-mesure.html` — app custom
- `diagnostic.html` — diagnosi gratuita
- `centralina.html` — pagina prodotto Centralina

## Note
- Sito in francese (target PMI svizzere/ginevrini)
- `WHY-COMUNICAZIONE.md` — strategia comunicazione
- `SCREENSHOT_BRIEF.md` — brief design
