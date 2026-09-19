# 🚀 Trade Skill — Apne VPS par Live karne ki Guide (tradeskill.in)

VPS IP: `187.127.98.41` | Domain: `tradeskill.in` | OS: Ubuntu 20.04/22.04

---

## STEP 0: Code VPS par lao

1. Emergent chat me **"Save to GitHub"** button se code GitHub par push karo
2. VPS me SSH karo: `ssh root@187.127.98.41`
3. Code clone karo:
```bash
cd /opt
git clone https://github.com/<APKA_USERNAME>/<REPO_NAME>.git tradeskill
cd tradeskill
```

## STEP 1: DNS set karo (GoDaddy/Namecheap/jahan se domain liya)

Domain panel me ye 2 records add karo:

| Type | Name | Value |
|------|------|-------|
| A | @ | 187.127.98.41 |
| A | www | 187.127.98.41 |

(DNS propagate hone me 5–30 min lagta hai)

## STEP 2: Server setup (one-shot script)

```bash
cd /opt/tradeskill/deploy
chmod +x setup_server.sh
sudo ./setup_server.sh
```

Ye script install karega: Python 3.11, Node 20 + Yarn, MongoDB 7, Nginx, Certbot.

## STEP 3: Environment variables bharo

```bash
cp /opt/tradeskill/deploy/backend.env.example /opt/tradeskill/backend/.env
nano /opt/tradeskill/backend/.env
```
> ⚠️ IMPORTANT: `MASTER_MNEMONIC`, `JWT_SECRET`, `ENCRYPTION_KEY` apne purane values
> Emergent ke backend/.env se copy karo (GitHub export me .env nahi jata — security).
> Emergent me VS Code view se backend/.env khol kar values copy kar lo.

```bash
cp /opt/tradeskill/deploy/frontend.env.example /opt/tradeskill/frontend/.env
# REACT_APP_BACKEND_URL=https://tradeskill.in hona chahiye
```

## STEP 4: Build + services start

```bash
cd /opt/tradeskill/deploy
chmod +x deploy_app.sh
sudo ./deploy_app.sh
```

Ye karega: backend venv + pip install, frontend `yarn build`,
systemd service (`tradeskill-backend`) enable + start, nginx config live.

## STEP 5: SSL (https) lagao

```bash
sudo certbot --nginx -d tradeskill.in -d www.tradeskill.in
```
(Email pucha to daal do, redirect option me `2` choose karo)

## STEP 6: Check karo ✅

```bash
systemctl status tradeskill-backend     # active (running) dikhna chahiye
curl https://tradeskill.in/api/         # {"app":"Trade Skill","status":"ok"}
```

Browser me kholo: **https://tradeskill.in** 🎉

> 🔥 India VPS = Binance geo-block khatam. Real trading ke liye ab
> Bind API me apni Binance API key daal kar LIVE mode chala sakte ho.

---

## Roz-marra commands

```bash
sudo systemctl restart tradeskill-backend   # backend restart
sudo journalctl -u tradeskill-backend -f    # backend logs live
cd /opt/tradeskill && git pull && sudo ./deploy/deploy_app.sh   # update deploy
```

## Common dikkat

| Problem | Fix |
|---------|-----|
| 502 Bad Gateway | `systemctl status tradeskill-backend` — backend crash logs dekho |
| API 404 | nginx config me `/api` proxy check: `nginx -t && systemctl reload nginx` |
| Mongo error | `systemctl status mongod` |
| SSL fail | DNS propagate hua? `dig tradeskill.in +short` = 187.127.98.41 hona chahiye |
