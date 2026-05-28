#!/bin/bash
# Deploy serafino-resout.ch → VPS
# Usage: bash deploy.sh
# Protegge file generati server-side (radar edizioni, app blasco/llm/etc)

set -e

SSH_KEY="$HOME/.ssh/hostinger_serafino"
REMOTE="root@srv1587393.hstgr.cloud"
REMOTE_PATH="/var/www/serafino-resout/site/"
LOCAL_PATH="$(dirname "$0")/site/"

echo "▶ Deploy serafino-resout.ch..."

rsync -avz --delete \
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
  --filter='protect radar-pme/20*.html' \
  -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH" \
  "$REMOTE:$REMOTE_PATH"

echo "✓ Deploy completato → https://www.serafino-resout.ch"
