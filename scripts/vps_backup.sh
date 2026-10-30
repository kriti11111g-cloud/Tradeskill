#!/bin/bash
# Trade Skill — DB Backup to EMAIL only (Telegram disabled for security)
# Cron (4x/day, har 6 ghante): 0 */6 * * * /opt/tradeskill/scripts/vps_backup.sh >> /var/log/tradeskill-backup.log 2>&1
#
# .env me chahiye:
#   RESEND_API_KEY=...            (email bhejne ke liye)
#   RESEND_FROM=Trade Skill <no-reply@tradeskill.in>
#   BACKUP_EMAIL=cryptoworld55555a@gmail.com   (optional, default yahi hai)

ENV_FILE="/opt/tradeskill/backend/.env"
BACKUP_DIR="/opt/tradeskill-backups"

getenv() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }

MONGO_URL=$(getenv MONGO_URL)
DB_NAME=$(getenv DB_NAME)
RESEND_KEY=$(getenv RESEND_API_KEY)
RESEND_FROM=$(getenv RESEND_FROM)
BACKUP_EMAIL=$(getenv BACKUP_EMAIL)
[ -z "$BACKUP_EMAIL" ] && BACKUP_EMAIL="cryptoworld55555a@gmail.com"

# Email bhejne wala helper
send_email() {
  # $1=subject  $2=text  $3=attachment_file (optional)
  [ -z "$RESEND_KEY" ] && { echo "[$(date)] Email skipped — RESEND_API_KEY missing"; return; }
  python3 - "$RESEND_KEY" "$RESEND_FROM" "$BACKUP_EMAIL" "$1" "$2" "${3:-}" <<'PY'
import sys, json, base64, urllib.request
key, frm, to, subject, text, att = sys.argv[1:7]
frm = frm or "Trade Skill <no-reply@tradeskill.in>"
payload = {"from": frm, "to": [to], "subject": subject, "text": text}
if att:
    try:
        with open(att, "rb") as f:
            payload["attachments"] = [{"filename": att.split("/")[-1],
                                       "content": base64.b64encode(f.read()).decode()}]
    except Exception as e:
        print("attach fail:", e)
req = urllib.request.Request("https://api.resend.com/emails",
    data=json.dumps(payload).encode(),
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
try:
    urllib.request.urlopen(req, timeout=40); print("email sent to", to)
except Exception as e:
    print("email fail:", e)
PY
}

if [ -z "$MONGO_URL" ] || [ -z "$DB_NAME" ]; then
  echo "[$(date)] ERROR: MONGO_URL/DB_NAME nahi mila $ENV_FILE me"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/tradeskill_${TS}.gz"

if ! mongodump --uri "$MONGO_URL" --db "$DB_NAME" --archive="$FILE" --gzip --quiet; then
  echo "[$(date)] ERROR: mongodump fail hua"
  send_email "⚠️ Trade Skill backup FAILED ($TS)" "mongodump failed on the VPS at $TS. Please check the server."
  exit 1
fi

SIZE=$(du -h "$FILE" | cut -f1)
echo "[$(date)] Backup done: $FILE ($SIZE)"

# Last 28 backups rakho (7 din x 4 per day)
ls -1t "$BACKUP_DIR"/tradeskill_*.gz 2>/dev/null | tail -n +29 | xargs -r rm -f

# --- Email par backup bhejo (Telegram DISABLED) ---
FSIZE=$(stat -c%s "$FILE" 2>/dev/null || echo 0)
if [ "$FSIZE" -gt 0 ] && [ "$FSIZE" -lt 20000000 ]; then
  send_email "✅ Trade Skill DB Backup — $TS" "Attached: Trade Skill database backup $TS ($SIZE). Keep it safe." "$FILE"
else
  send_email "⚠️ Trade Skill DB Backup — $TS (too large to attach)" "Backup $TS is $SIZE — too large to email. It is saved on the VPS at $FILE."
fi
