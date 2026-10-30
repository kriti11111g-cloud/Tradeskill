#!/bin/bash
# Trade Skill — Daily DB Backup (local + dedicated Telegram bot + Email)
# Cron: 0 */6 * * * /opt/tradeskill/scripts/vps_backup.sh >> /var/log/tradeskill-backup.log 2>&1 (har 6 ghante)
#
# IMPORTANT: Backup ka Telegram bot ALAG hona chahiye (channel-verification bot NAHI).
# .env me ye set karo:
#   BACKUP_BOT_TOKEN=<purana/dedicated backup bot token>
#   BACKUP_CHAT_ID=<aapka private chat id, jaise 7938316697>
#   BACKUP_EMAIL=cryptoworld55555a@gmail.com   (optional, default yahi hai)

ENV_FILE="/opt/tradeskill/backend/.env"
BACKUP_DIR="/opt/tradeskill-backups"

getenv() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }

MONGO_URL=$(getenv MONGO_URL)
DB_NAME=$(getenv DB_NAME)
# Dedicated backup bot ONLY (never fall back to the public channel bot)
TG_TOKEN=$(getenv BACKUP_BOT_TOKEN)
TG_CHAT=$(getenv BACKUP_CHAT_ID)
# Email (Resend)
RESEND_KEY=$(getenv RESEND_API_KEY)
RESEND_FROM=$(getenv RESEND_FROM)
BACKUP_EMAIL=$(getenv BACKUP_EMAIL)
[ -z "$BACKUP_EMAIL" ] && BACKUP_EMAIL="cryptoworld55555a@gmail.com"

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
    curl -s -F chat_id="$TG_CHAT" -F text="⚠️ Trade Skill backup FAILED ($TS). Check the VPS!" \
      "https://api.telegram.org/bot$TG_TOKEN/sendMessage" > /dev/null
  fi
  exit 1
fi

SIZE=$(du -h "$FILE" | cut -f1)
echo "[$(date)] Backup done: $FILE ($SIZE)"

# Last 28 backups rakho (7 din x 4 per day)
ls -1t "$BACKUP_DIR"/tradeskill_*.gz 2>/dev/null | tail -n +29 | xargs -r rm -f

# --- 1) Dedicated Telegram backup bot par copy bhejo ---
if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  curl -s -F chat_id="$TG_CHAT" -F document=@"$FILE" \
    -F caption="✅ Trade Skill DB Backup — $TS ($SIZE). Data safe." \
    "https://api.telegram.org/bot$TG_TOKEN/sendDocument" > /dev/null \
    && echo "[$(date)] Telegram (backup bot) par bhej diya" \
    || echo "[$(date)] Telegram send fail (BACKUP_BOT_TOKEN/BACKUP_CHAT_ID check karo)"
else
  echo "[$(date)] Telegram backup skipped — BACKUP_BOT_TOKEN/BACKUP_CHAT_ID set nahi hai"
fi

# --- 2) Email par copy bhejo (Resend) ---
if [ -n "$RESEND_KEY" ]; then
  FSIZE=$(stat -c%s "$FILE" 2>/dev/null || echo 0)
  if [ "$FSIZE" -gt 0 ] && [ "$FSIZE" -lt 20000000 ]; then
    python3 - "$FILE" "$RESEND_KEY" "$RESEND_FROM" "$BACKUP_EMAIL" "$TS" "$SIZE" <<'PY'
import sys, base64, json, urllib.request
file, key, frm, to, ts, size = sys.argv[1:7]
frm = frm or "Trade Skill <no-reply@tradeskill.in>"
with open(file, "rb") as f:
    content = base64.b64encode(f.read()).decode()
body = json.dumps({
    "from": frm, "to": [to],
    "subject": f"Trade Skill DB Backup — {ts}",
    "text": f"Attached: Trade Skill database backup {ts} ({size}). Keep it safe.",
    "attachments": [{"filename": file.split("/")[-1], "content": content}],
}).encode()
req = urllib.request.Request("https://api.resend.com/emails", data=body,
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
try:
    urllib.request.urlopen(req, timeout=40)
    print("email sent to", to)
except Exception as e:
    print("email fail:", e)
PY
  else
    # Too big to attach — email a notice instead
    python3 - "$RESEND_KEY" "$RESEND_FROM" "$BACKUP_EMAIL" "$TS" "$SIZE" <<'PY'
import sys, json, urllib.request
key, frm, to, ts, size = sys.argv[1:6]
frm = frm or "Trade Skill <no-reply@tradeskill.in>"
body = json.dumps({"from": frm, "to": [to],
    "subject": f"Trade Skill DB Backup — {ts} (too large to attach)",
    "text": f"Backup {ts} is {size} — too large to email. It is saved on the VPS and sent to Telegram."}).encode()
req = urllib.request.Request("https://api.resend.com/emails", data=body,
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
try:
    urllib.request.urlopen(req, timeout=20); print("email notice sent")
except Exception as e:
    print("email fail:", e)
PY
  fi
else
  echo "[$(date)] Email backup skipped — RESEND_API_KEY set nahi hai"
fi
