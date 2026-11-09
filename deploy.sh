#!/bin/bash
# Deploy serafino-resout.ch → VPS
# Usage: bash deploy.sh
#
# site/moca/ e' un repo git a se stante (privato). La sua .git NON deve
# finire sul web server: da qui l'esclusione di .git/ piu' sotto.
#
# ATTENZIONE: questo deploy NON cancella in automatico i file remoti assenti
# in locale, e non deve farlo. Sul server vivono file che NON sono in questo
# repo (quasimodo/, edizioni radar-pme, app blasco/llm/crm/...): una pulizia
# automatica li distruggerebbe. Le pagine da ritirare si elencano in RETIRED
# e si rimuovono esplicitamente, una per una.

set -e

# Deploy solo da commit: il live deve sempre essere uguale al repo.
SITE_STATUS=$(git -C "$(dirname "$0")" status --porcelain -- site/) || { echo "✖ git status fallito: deploy annullato." >&2; exit 1; }
if [ -n "$SITE_STATUS" ]; then
  echo "✖ site/ ha modifiche non committate: committa prima di pubblicare." >&2
  git -C "$(dirname "$0")" status --short -- site/ >&2
  exit 1
fi

SSH_KEY="$HOME/.ssh/hostinger_serafino"
REMOTE="root@srv1587393.hstgr.cloud"
REMOTE_PATH="/var/www/serafino-resout/site/"
LOCAL_PATH="$(dirname "$0")/site/"

# Pagine ritirate: rimosse dal server a ogni deploy (rifocalizzazione 2026-07)
RETIRED=(
  ateliers-ia.html
  coaching-vibe-coder.html
  plan-de-veille.html
  # nuova linea 2026-11: rimuovere SOLO dopo che deploy/nginx-redirects.conf e' incluso (altrimenti 404 invece di 301)
  pme.html
  artisans.html
  horeca.html
  automatisation.html
  app-sur-mesure.html
  marketing-publicite-geneve.html
  geneve.html
  formation-ia.html
  ia-locale-geneve.html
  bot-personalise.html
  cas-planeto.html
  styles.css
)

echo "▶ Deploy serafino-resout.ch..."

rsync -avz \
  --exclude='.git/' \
  --exclude='.gitignore' \
  --exclude='index_backup_*.html' \
  --exclude='design_analysis.html' \
  --exclude='google8c800af58b1ca82e.html' \
  --exclude='blasco/' \
  --exclude='llm/' \
  --exclude='denise/' \
  --exclude='karaoke/' \
  --exclude='crm/' \
  --exclude='serafino/' \
  --exclude='radar/' \
  --exclude='quasimodo/' \
  --exclude='radar-pme/' \
  --exclude='*.md' \
  --exclude='antigravity-ide:/' \
  -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH" \
  "$REMOTE:$REMOTE_PATH"

if [ ${#RETIRED[@]} -gt 0 ]; then
  echo "▶ Rimozione pagine ritirate..."
  for page in "${RETIRED[@]}"; do
    ssh -i "$SSH_KEY" "$REMOTE" "rm -f '$REMOTE_PATH$page'"
    echo "  ✗ $page"
  done
fi

echo "✓ Deploy completato → https://www.serafino-resout.ch"
