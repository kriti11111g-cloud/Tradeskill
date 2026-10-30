#!/bin/bash
# Trade Skill — DB Backup to EMAIL only (Gmail SMTP). Telegram disabled for security.
# Cron (4x/day, har 6 ghante): 0 */6 * * * /opt/tradeskill/scripts/vps_backup.sh >> /var/log/tradeskill-backup.log 2>&1
#
# .env me chahiye (OTP ke liye already set hote hain):
#   GMAIL_USER=yourgmail@gmail.com
#   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (Google App Password)
#   BACKUP_EMAIL=cryptoworld55555a@gmail.com  (optional, default yahi hai)

ENV_FILE="/opt/tradeskill/backend/.env"
BACKUP_DIR="/opt/tradeskill-backups"

getenv() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }

MONGO_URL=$(getenv MONGO_URL)
DB_NAME=$(getenv DB_NAME)
GMAIL_USER=$(getenv GMAIL_USER)
GMAIL_APP_PASSWORD=$(getenv GMAIL_APP_PASSWORD)
BACKUP_EMAIL=$(getenv BACKUP_EMAIL)
[ -z "$BACKUP_EMAIL" ] && BACKUP_EMAIL="cryptoworld55555a@gmail.com"

# Gmail SMTP se email bhejne wala helper:  send_email "subject" "body" "attachment_or_empty"
send_email() {
  if [ -z "$GMAIL_USER" ] || [ -z "$GMAIL_APP_PASSWORD" ]; then
    echo "[$(date)] Email skipped — GMAIL_USER/GMAIL_APP_PASSWORD missing in .env"; return
  fi
  python3 - "$GMAIL_USER" "$GMAIL_APP_PASSWORD" "$BACKUP_EMAIL" "$1" "$2" "${3:-}" <<'PY'
import sys, smtplib, ssl, os
from email.message import EmailMessage
user, pw, to, subject, text, att = sys.argv[1:7]
pw = pw.replace(" ", "")  # Google app passwords may be shown with spaces
msg = EmailMessage()
msg["From"] = user
msg["To"] = to
msg["Subject"] = subject
msg.set_content(text)
if att and os.path.exists(att):
    with open(att, "rb") as f:
        msg.add_attachment(f.read(), maintype="application", subtype="gzip",
                           filename=att.split("/")[-1])
try:
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=60) as s:
        s.starttls(context=ssl.create_default_context())
        s.login(user, pw)
        s.send_message(msg)
    print("email sent to", to)
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

# --- Email par backup bhejo (Gmail SMTP, 25MB tak). Telegram DISABLED ---
FSIZE=$(stat -c%s "$FILE" 2>/dev/null || echo 0)
if [ "$FSIZE" -gt 0 ] && [ "$FSIZE" -lt 24000000 ]; then
  send_email "✅ Trade Skill DB Backup — $TS" "Attached: Trade Skill database backup $TS ($SIZE). Keep it safe." "$FILE"
else
  send_email "⚠️ Trade Skill DB Backup — $TS (too large to attach)" "Backup $TS is $SIZE — over 24MB, too large to email. It is saved on the VPS at $FILE."
fi
