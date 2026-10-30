#!/bin/bash
# Trade Skill — DB Backup to Gmail (readable JSON in a .zip). Telegram disabled.
# Cron (4x/day): 0 */6 * * * /opt/tradeskill/scripts/vps_backup.sh >> /var/log/tradeskill-backup.log 2>&1
#
# .env me chahiye: GMAIL_USER, GMAIL_APP_PASSWORD, (optional) BACKUP_EMAIL

ENV_FILE="${ENV_FILE:-/opt/tradeskill/backend/.env}"
BACKUP_DIR="/opt/tradeskill-backups"

getenv() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }

MONGO_URL=$(getenv MONGO_URL)
DB_NAME=$(getenv DB_NAME)
GMAIL_USER=$(getenv GMAIL_USER)
GMAIL_APP_PASSWORD=$(getenv GMAIL_APP_PASSWORD)
BACKUP_EMAIL=$(getenv BACKUP_EMAIL)
[ -z "$BACKUP_EMAIL" ] && BACKUP_EMAIL="cryptoworld55555a@gmail.com"

send_email() {   # send_email "subject" "body" "attachment_or_empty"
  if [ -z "$GMAIL_USER" ] || [ -z "$GMAIL_APP_PASSWORD" ]; then
    echo "[$(date)] Email skipped — GMAIL_USER/GMAIL_APP_PASSWORD missing"; return
  fi
  python3 - "$GMAIL_USER" "$GMAIL_APP_PASSWORD" "$BACKUP_EMAIL" "$1" "$2" "${3:-}" <<'PY'
import sys, smtplib, ssl, os
from email.message import EmailMessage
user, pw, to, subject, text, att = sys.argv[1:7]
pw = pw.replace(" ", "")
msg = EmailMessage(); msg["From"]=user; msg["To"]=to; msg["Subject"]=subject; msg.set_content(text)
if att and os.path.exists(att):
    with open(att,"rb") as f:
        msg.add_attachment(f.read(), maintype="application", subtype="zip", filename=att.split("/")[-1])
try:
    with smtplib.SMTP("smtp.gmail.com",587,timeout=120) as s:
        s.starttls(context=ssl.create_default_context()); s.login(user,pw); s.send_message(msg)
    print("email sent to", to)
except Exception as e:
    print("email fail:", e)
PY
}

if [ -z "$MONGO_URL" ] || [ -z "$DB_NAME" ]; then
  echo "[$(date)] ERROR: MONGO_URL/DB_NAME nahi mila $ENV_FILE me"; exit 1
fi

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
DUMP_DIR="/tmp/tsk_dump_$TS"
JSON_DIR="/tmp/tsk_json_$TS"
FILE="$BACKUP_DIR/tradeskill_${TS}.zip"

# 1) Dump (to get collection list) + export each collection as readable JSON
if ! mongodump --uri "$MONGO_URL" --db "$DB_NAME" --out "$DUMP_DIR" --quiet; then
  echo "[$(date)] ERROR: mongodump fail hua"
  send_email "⚠️ Trade Skill backup FAILED ($TS)" "mongodump failed on the VPS at $TS. Check the server."
  exit 1
fi

mkdir -p "$JSON_DIR"
for bson in "$DUMP_DIR/$DB_NAME"/*.bson; do
  [ -e "$bson" ] || continue
  coll=$(basename "$bson" .bson)
  mongoexport --uri "$MONGO_URL" --db "$DB_NAME" --collection "$coll" \
    --jsonArray --pretty -o "$JSON_DIR/$coll.json" --quiet 2>/dev/null
done

# 2) Zip the JSON folder (python zipfile — no external 'zip' needed)
python3 - "$JSON_DIR" "$FILE" <<'PY'
import sys, os, zipfile
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in sorted(os.listdir(src)):
        z.write(os.path.join(src, name), arcname=name)
print("zip created:", out)
PY

rm -rf "$DUMP_DIR" "$JSON_DIR"
SIZE=$(du -h "$FILE" | cut -f1)
echo "[$(date)] Backup done: $FILE ($SIZE)"

# keep last 28
ls -1t "$BACKUP_DIR"/tradeskill_*.zip 2>/dev/null | tail -n +29 | xargs -r rm -f

# 3) Email it (Gmail SMTP). Telegram DISABLED.
FSIZE=$(stat -c%s "$FILE" 2>/dev/null || echo 0)
if [ "$FSIZE" -gt 0 ] && [ "$FSIZE" -lt 24000000 ]; then
  send_email "✅ Trade Skill DB Backup — $TS" "Attached: Trade Skill database backup $TS ($SIZE) as readable JSON files inside a .zip. Open the zip to view all data." "$FILE"
else
  send_email "⚠️ Trade Skill DB Backup — $TS (too large to attach)" "Backup $TS is $SIZE — over 24MB, too large to email. It is saved on the VPS at $FILE."
fi
