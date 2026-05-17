#!/usr/bin/env python3
"""
Radar PME — Envoi quotidien aux abonnés Telegram
Appelé par cron à 7h30 chaque matin
"""

import os
import re
import sqlite3
import asyncio
import logging
from datetime import date
from pathlib import Path
import httpx

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO
)
log = logging.getLogger(__name__)

TOKEN    = os.environ.get("RADAR_BOT_TOKEN", "")
DB_PATH  = os.environ.get("RADAR_DB_PATH", "/opt/radar/subscribers.db")
SITE_DIR = Path("/var/www/serafino-resout/site/radar-pme")

# ── HTML parser ──────────────────────────────────────────────────────────────

def clean(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"&amp;", "&", s)
    s = re.sub(r"&lt;", "<", s)
    s = re.sub(r"&gt;", ">", s)
    s = re.sub(r"&nbsp;", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()

def parse_radar(html: str) -> dict:
    # Signal fort
    sf_match = re.search(r'<div class="signal-fort">(.*?)</div>\s*</div>', html, re.S)
    signal = ""
    if sf_match:
        signal = clean(sf_match.group(1))

    # Articles
    cards = re.findall(r'<article class="item-card[^>]*>(.*?)</article>', html, re.S)
    articles = []
    for card in cards:
        title_m  = re.search(r'class="item-title"[^>]*>(.*?)</h3>', card, re.S)
        resume_m = re.search(r'class="item-resume"[^>]*>(.*?)</p>', card, re.S)
        if title_m:
            articles.append({
                "title":  clean(title_m.group(1)),
                "resume": clean(resume_m.group(1)) if resume_m else "",
            })
    return {"signal": signal, "articles": articles}

def build_message(radar: dict, today: date) -> str:
    date_str = today.strftime("%-d %B %Y")
    lines = [
        f"📡 *Radar PME Suisse — {date_str}*",
        "_L'essentiel du numérique et de l'IA pour les PME romandes._",
        "",
    ]

    if radar["signal"]:
        sf = radar["signal"][:240]
        if len(radar["signal"]) > 240:
            sf += "…"
        lines += [f"📌 *Signal fort*", sf, ""]

    for i, art in enumerate(radar["articles"][:5], 1):
        resume = art["resume"][:160] + ("…" if len(art["resume"]) > 160 else "")
        lines.append(f"*{i}. {art['title']}*")
        if resume:
            lines.append(resume)
        lines.append("")

    lines.append(
        f"→ Édition complète : https://serafino-resout.ch/radar-pme/{today.strftime('%Y-%m-%d')}.html"
    )
    return "\n".join(lines)

# ── Load radar ───────────────────────────────────────────────────────────────

def get_radar_content() -> dict | None:
    today = date.today()
    radar_file = SITE_DIR / f"{today.strftime('%Y-%m-%d')}.html"
    if not radar_file.exists():
        log.warning(f"No radar file for today: {radar_file}")
        return None
    radar = parse_radar(radar_file.read_text())
    if not radar["articles"]:
        log.warning("No articles found — check HTML structure")
        return None
    log.info(f"Parsed {len(radar['articles'])} articles")
    return radar

# ── Send ─────────────────────────────────────────────────────────────────────

async def send_to_all(text: str):
    con  = sqlite3.connect(DB_PATH)
    rows = con.execute(
        "SELECT chat_id, username FROM subscribers WHERE active=1"
    ).fetchall()
    con.close()

    if not rows:
        log.info("No active subscribers.")
        return

    log.info(f"Sending to {len(rows)} subscribers...")
    ok, fail = 0, 0

    async with httpx.AsyncClient() as client:
        for chat_id, username in rows:
            try:
                r = await client.post(
                    f"https://api.telegram.org/bot{TOKEN}/sendMessage",
                    json={
                        "chat_id":    chat_id,
                        "text":       text,
                        "parse_mode": "Markdown",
                        "disable_web_page_preview": True,
                    },
                    timeout=10
                )
                if r.status_code == 200:
                    ok += 1
                    log.info(f"OK: {chat_id} @{username}")
                else:
                    data = r.json()
                    if data.get("error_code") in (403, 400):
                        log.warning(f"Deactivating {chat_id}: {data.get('description')}")
                        c = sqlite3.connect(DB_PATH)
                        c.execute("UPDATE subscribers SET active=0 WHERE chat_id=?", (chat_id,))
                        c.commit()
                        c.close()
                    fail += 1
            except Exception as e:
                log.error(f"Exception {chat_id}: {e}")
                fail += 1

    log.info(f"Done — {ok} OK, {fail} failed")

async def main():
    if not TOKEN:
        raise ValueError("RADAR_BOT_TOKEN not set")
    radar = get_radar_content()
    if not radar:
        return
    text = build_message(radar, date.today())
    await send_to_all(text)

if __name__ == "__main__":
    asyncio.run(main())
