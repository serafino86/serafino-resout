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

SSH_KEY="$HOME/.ssh/hostinger_serafino"
REMOTE="root@srv1587393.hstgr.cloud"
REMOTE_PATH="/var/www/serafino-resout/site/"
LOCAL_PATH="$(dirname "$0")/site/"

# Pagine ritirate: rimosse dal server a ogni deploy (rifocalizzazione 2026-07)
RETIRED=(
  app-sur-mesure.html
  ateliers-ia.html
  automatisation.html
  coaching-vibe-coder.html
  formation-ia.html
  plan-de-veille.html
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
