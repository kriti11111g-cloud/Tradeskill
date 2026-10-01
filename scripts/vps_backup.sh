#!/bin/bash
# Trade Skill — Daily DB Backup (local + Telegram copy)
# Cron: 0 */6 * * * /opt/tradeskill/scripts/vps_backup.sh >> /var/log/tradeskill-backup.log 2>&1 (har 6 ghante)

ENV_FILE="/opt/tradeskill/backend/.env"
BACKUP_DIR="/opt/tradeskill-backups"

MONGO_URL=$(grep -E '^MONGO_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
TG_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
TG_CHAT=$(grep -E '^TELEGRAM_CHAT_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -z "$MONGO_URL" ] || [ -z "$DB_NAME" ]; then
  echo "[$(date)] ERROR: MONGO_URL/DB_NAME nahi mila $ENV_FILE me"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/tradeskill_${TS}.gz"

if ! mongodump --uri "$MONGO_URL" --db "$DB_NAME" --archive="$FILE" --gzip --quiet; then
  echo "[$(date)] ERROR: mongodump fail hua"
  if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
    curl -s -F chat_id="$TG_CHAT" -F text="⚠️ Trade Skill backup FAIL hua ($TS). VPS check karo!" \
      "https://api.telegram.org/bot$TG_TOKEN/sendMessage" > /dev/null
  fi
  exit 1
fi

SIZE=$(du -h "$FILE" | cut -f1)
echo "[$(date)] Backup done: $FILE ($SIZE)"

# Last 28 backups rakho (7 din x 4 per day)
ls -1t "$BACKUP_DIR"/tradeskill_*.gz 2>/dev/null | tail -n +29 | xargs -r rm -f

# Telegram par copy bhejo (agar token set hai)
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  curl -s -F chat_id="$TG_CHAT" -F document=@"$FILE" \
    -F caption="✅ Trade Skill DB Backup — $TS ($SIZE). Data safe." \
    "https://api.telegram.org/bot$TG_TOKEN/sendDocument" > /dev/null \
    && echo "[$(date)] Telegram par bhej diya" \
    || echo "[$(date)] Telegram send fail (token/chat check karo)"
fi
