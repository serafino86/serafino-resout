#!/usr/bin/env python3
"""
Radar PME — Bot Telegram abonnement
Un radar quotidien, même édition pour tous.
"""

import os
import sqlite3
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO
)
log = logging.getLogger(__name__)

TOKEN   = os.environ.get("RADAR_BOT_TOKEN", "")
DB_PATH       = os.environ.get("RADAR_DB_PATH", "/opt/radar/subscribers.db")
ADMIN_CHAT_ID = int(os.environ.get("RADAR_ADMIN_CHAT_ID", "1406623469"))

# ── DB ───────────────────────────────────────────────────────────────────────

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS subscribers (
            chat_id   INTEGER PRIMARY KEY,
            username  TEXT,
            sector    TEXT DEFAULT '',
            active    INTEGER DEFAULT 1,
            created   TEXT DEFAULT (datetime('now'))
        )
    """)
    con.commit()
    con.close()

def upsert_subscriber(chat_id: int, username: str):
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        INSERT INTO subscribers (chat_id, username, active)
        VALUES (?, ?, 1)
        ON CONFLICT(chat_id) DO UPDATE SET username=excluded.username, active=1
    """, (chat_id, username or ""))
    con.commit()
    con.close()

def deactivate(chat_id: int):
    con = sqlite3.connect(DB_PATH)
    con.execute("UPDATE subscribers SET active=0 WHERE chat_id=?", (chat_id,))
    con.commit()
    con.close()

def is_active(chat_id: int) -> bool:
    con = sqlite3.connect(DB_PATH)
    row = con.execute(
        "SELECT active FROM subscribers WHERE chat_id=?", (chat_id,)
    ).fetchone()
    con.close()
    return bool(row and row[0])

# ── Handlers ─────────────────────────────────────────────────────────────────


async def notify_admin(app, username: str, chat_id: int):
    try:
        await app.bot.send_message(
            chat_id=ADMIN_CHAT_ID,
            text=f"📡 Nouveau abonné Radar PME\n@{username} ({chat_id})"
        )
    except Exception as e:
        log.warning(f"Admin notify failed: {e}")

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id  = update.effective_chat.id
    username = update.effective_user.username or update.effective_user.first_name or ""

    if is_active(chat_id):
        await update.message.reply_text(
            "Vous êtes déjà abonné au Radar PME Suisse.\n\n"
            "Chaque matin vers 7h30, vous recevez l'essentiel du numérique "
            "et de l'IA pour les PME romandes — sans jargon.\n\n"
            "Se désabonner : /stop"
        )
        return

    upsert_subscriber(chat_id, username)
    log.info(f"New subscriber: {chat_id} @{username}")
    await notify_admin(ctx.application, username, chat_id)

    await update.message.reply_text(
        "📡 *Radar PME Suisse*\n\n"
        "Abonnement confirmé. Chaque matin vers 7h30, vous recevrez "
        "une sélection de l'actualité IA et numérique utile aux patrons "
        "de PME, artisans et indépendants à Genève.\n\n"
        "Sans jargon. Sans bruit. Directement ici.\n\n"
        "Se désabonner à tout moment : /stop\n"
        "Voir la dernière édition : https://serafino-resout.ch/radar-pme",
        parse_mode="Markdown",
        disable_web_page_preview=True,
    )

async def cmd_stop(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    deactivate(chat_id)
    log.info(f"Unsubscribed: {chat_id}")
    await update.message.reply_text(
        "Vous avez été désabonné du Radar PME.\n\n"
        "Pour vous réabonner : /start"
    )

async def cmd_stats(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id != ADMIN_CHAT_ID:
        return
    con = sqlite3.connect(DB_PATH)
    total = con.execute("SELECT COUNT(*) FROM subscribers WHERE active=1").fetchone()[0]
    con.close()
    await update.message.reply_text(f"📊 Abonnés actifs : {total}")

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not TOKEN:
        raise ValueError("RADAR_BOT_TOKEN not set")
    init_db()
    log.info("Radar PME Bot starting...")
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("stop",  cmd_stop))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
