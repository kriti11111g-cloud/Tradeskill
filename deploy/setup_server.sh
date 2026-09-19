#!/usr/bin/env bash
# Trade Skill — VPS one-shot server setup (Ubuntu 20.04/22.04)
set -e

echo "==> System update"
apt-get update -y

echo "==> Basics"
apt-get install -y curl gnupg git build-essential software-properties-common

echo "==> Python 3.11"
add-apt-repository -y ppa:deadsnakes/ppa || true
apt-get update -y
apt-get install -y python3.11 python3.11-venv python3.11-dev || apt-get install -y python3 python3-venv python3-dev

echo "==> Node 20 + Yarn"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g yarn

echo "==> MongoDB 7"
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -y
apt-get install -y mongodb-org
systemctl enable --now mongod

echo "==> Nginx + Certbot"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx

echo "==> Firewall"
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true

echo ""
echo "✅ Server setup complete!"
echo "Agla step: backend/.env + frontend/.env bharo, phir ./deploy_app.sh chalao"
