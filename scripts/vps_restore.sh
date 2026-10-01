#!/bin/bash
# Trade Skill — DB Restore from backup file
# Usage: /opt/tradeskill/scripts/vps_restore.sh /opt/tradeskill-backups/tradeskill_XXXX.gz

ENV_FILE="/opt/tradeskill/backend/.env"
MONGO_URL=$(grep -E '^MONGO_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -z "$1" ] || [ ! -f "$1" ]; then
  echo "Usage: $0 <backup-file.gz>"
  echo "Available backups:"
  ls -1t /opt/tradeskill-backups/tradeskill_*.gz 2>/dev/null
  exit 1
fi

echo "⚠️  Ye current database ko backup se REPLACE kar dega. 5 sec me start hoga (Ctrl+C se cancel)..."
sleep 5
mongorestore --uri "$MONGO_URL" --archive="$1" --gzip --drop
echo "✅ Restore complete: $1"
