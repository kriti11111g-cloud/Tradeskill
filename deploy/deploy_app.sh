#!/usr/bin/env bash
# Trade Skill — build + deploy (run after setup_server.sh and .env files ready)
set -e
APP_DIR="/opt/tradeskill"
PY=$(command -v python3.11 || command -v python3)

echo "==> Backend venv + deps"
cd "$APP_DIR/backend"
[ -d venv ] || $PY -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

echo "==> Frontend build"
cd "$APP_DIR/frontend"
yarn install --frozen-lockfile || yarn install
yarn build

echo "==> Systemd service"
cp "$APP_DIR/deploy/tradeskill-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable tradeskill-backend
systemctl restart tradeskill-backend

echo "==> Nginx config"
cp "$APP_DIR/deploy/nginx-tradeskill.conf" /etc/nginx/sites-available/tradeskill
ln -sf /etc/nginx/sites-available/tradeskill /etc/nginx/sites-enabled/tradeskill
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "✅ Deploy complete!"
echo "SSL ke liye: sudo certbot --nginx -d tradeskill.in -d www.tradeskill.in"
echo "Check: curl http://tradeskill.in/api/"
