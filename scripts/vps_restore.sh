#!/bin/bash
# Trade Skill — Restore DB from a backup .zip (readable JSON collections).
# Usage:  bash scripts/vps_restore.sh /opt/tradeskill-backups/tradeskill_YYYYMMDD_HHMMSS.zip
#
# Har JSON file ek collection hai. Ye script wahi data wapas usi DB me daal deti hai.
# Default: SAFE merge mode — same _id wale records overwrite (upsert) hote hain, baaki waise rehte hain. Kuch delete nahi hota.
# Full replace (collection pehle khaali karke bhar do):  MODE=replace bash scripts/vps_restore.sh <zip>

ENV_FILE="${ENV_FILE:-/opt/tradeskill/backend/.env}"
ZIP="$1"
MODE="${MODE:-merge}"   # merge (default, safe) | replace

getenv() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }
MONGO_URL=$(getenv MONGO_URL)
DB_NAME=$(getenv DB_NAME)

if [ -z "$ZIP" ] || [ ! -f "$ZIP" ]; then
  echo "Usage: bash scripts/vps_restore.sh <path-to-backup.zip>"
  echo "Available backups:"; ls -1t /opt/tradeskill-backups/tradeskill_*.zip 2>/dev/null | head
  exit 1
fi
if [ -z "$MONGO_URL" ] || [ -z "$DB_NAME" ]; then
  echo "ERROR: MONGO_URL/DB_NAME nahi mila $ENV_FILE me"; exit 1
fi

echo "Restore from : $ZIP"
echo "Into DB      : $DB_NAME"
echo "Mode         : $MODE"
read -p "Pakka restore karein? (yes/no): " ok
[ "$ok" = "yes" ] || { echo "Cancelled."; exit 0; }

TMP="/tmp/tsk_restore_$(date +%s)"
mkdir -p "$TMP"
python3 - "$ZIP" "$TMP" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z: z.extractall(sys.argv[2])
print("extracted")
PY

for json in "$TMP"/*.json; do
  [ -e "$json" ] || continue
  coll=$(basename "$json" .json)
  if [ "$MODE" = "replace" ]; then
    echo "  replacing: $coll"
    mongoimport --uri "$MONGO_URL" --db "$DB_NAME" --collection "$coll" \
      --jsonArray --drop --file "$json" --quiet
  else
    echo "  merging: $coll"
    mongoimport --uri "$MONGO_URL" --db "$DB_NAME" --collection "$coll" \
      --jsonArray --mode upsert --file "$json" --quiet
  fi
done

rm -rf "$TMP"
echo "Restore done from $ZIP"
