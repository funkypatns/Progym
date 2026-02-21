# Ubuntu Cloud Runbook (Gym Management + License Server)

## 1) Purpose
Use this runbook to deploy the full system on a single Ubuntu cloud server:
- Gym frontend (Vite build, served by Nginx)
- Gym backend API (Node + Prisma + PostgreSQL)
- License server (Node + SQLite file)
- HTTPS with Let's Encrypt
- Auto-start/restart with `systemd`

This guide is written to run from zero to production-ready.

---

## 2) Target Architecture
- `app.example.com` -> frontend static files + `/api` proxy to gym backend
- `license.example.com` -> license server APIs + `/admin` device/vendor admin UI
- PostgreSQL local on same VPS

Ports:
- Nginx: `80`, `443` (public)
- Backend: `3001` (localhost only)
- License server: `4000` (localhost only)
- PostgreSQL: `5432` (localhost only)

---

## 3) Prerequisites
Before starting:
1. Ubuntu server (22.04/24.04), root SSH access.
2. DNS A records:
   - `app.example.com` -> server public IP
   - `license.example.com` -> server public IP
3. Project files uploaded to:
   - `/var/www/gym-management-system`

If your folder is different, replace paths in this runbook.

---

## 4) Server Bootstrap
Run as root:

```bash
apt update && apt upgrade -y
apt install -y curl ca-certificates gnupg git build-essential nginx certbot python3-certbot-nginx postgresql postgresql-contrib
```

Install Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

Optional firewall:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

---

## 5) Create Runtime User + Folders
```bash
useradd --system --create-home --shell /bin/bash gymapp || true
mkdir -p /var/lib/gym-app /var/lib/gym-license /etc/gym /etc/gym/keys
chown -R gymapp:gymapp /var/lib/gym-app /var/lib/gym-license
chown -R gymapp:gymapp /var/www/gym-management-system
chmod 700 /etc/gym
chmod 700 /etc/gym/keys
```

---

## 6) PostgreSQL Setup (Backend DB)
Create DB/user:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER gymuser WITH PASSWORD 'CHANGE_THIS_DB_PASSWORD';
CREATE DATABASE gymdb OWNER gymuser;
GRANT ALL PRIVILEGES ON DATABASE gymdb TO gymuser;
SQL
```

Quick check:

```bash
sudo -u postgres psql -c "\l" | grep gymdb
```

---

## 7) Install Project Dependencies
```bash
cd /var/www/gym-management-system

cd backend
npm ci

cd ../frontend
npm ci

cd ../license-server
npm ci
```

---

## 8) Generate License/Integrity RSA Keys
Generate one RSA keypair (used for license JWT + integrity signing):

```bash
openssl genpkey -algorithm RSA -out /etc/gym/keys/license-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in /etc/gym/keys/license-private.pem -out /etc/gym/keys/license-public.pem
chmod 600 /etc/gym/keys/license-private.pem
chmod 644 /etc/gym/keys/license-public.pem
```

Create escaped single-line PEM values (required by current license-server env parsing):

```bash
PRIVATE_ESCAPED=$(awk '{printf "%s\\n",$0}' /etc/gym/keys/license-private.pem)
PUBLIC_ESCAPED=$(awk '{printf "%s\\n",$0}' /etc/gym/keys/license-public.pem)
echo "$PRIVATE_ESCAPED" > /tmp/license-private-escaped.txt
echo "$PUBLIC_ESCAPED" > /tmp/license-public-escaped.txt
```

---

## 9) Environment Files
Create backend env:

```bash
cat >/etc/gym/backend.env <<'ENV'
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://gymuser:CHANGE_THIS_DB_PASSWORD@127.0.0.1:5432/gymdb?schema=public
JWT_SECRET=CHANGE_THIS_BACKEND_JWT_SECRET
CORS_ORIGIN=https://app.example.com
USER_DATA_PATH=/var/lib/gym-app
LICENSE_SERVER_URL=https://license.example.com
LICENSE_VALIDATE_INTERVAL_HOURS=24
LICENSE_OFFLINE_GRACE_HOURS=72
PRISMA_CLIENT_ENGINE_TYPE=library
INTEGRITY_PUBLIC_KEY_PATH=/etc/gym/keys/license-public.pem
ENV
chmod 600 /etc/gym/backend.env
```

Create license-server env:

```bash
cat >/etc/gym/license-server.env <<'ENV'
NODE_ENV=production
PORT=4000
LICENSE_SERVER_DATA_PATH=/var/lib/gym-license
LICENSE_ADMIN_JWT_SECRET=CHANGE_THIS_LICENSE_ADMIN_JWT_SECRET
LICENSE_ADMIN_JWT_EXPIRES_IN=12h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=CHANGE_THIS_LICENSE_ADMIN_PASSWORD
LICENSE_VALIDATE_INTERVAL_HOURS=24
LICENSE_OFFLINE_GRACE_HOURS=72
PUBLIC_VENDOR_PROFILE_RATE_WINDOW_MS=60000
PUBLIC_VENDOR_PROFILE_RATE_MAX=120
ENV
chmod 600 /etc/gym/license-server.env
```

Append RSA keys to license-server env:

```bash
echo "LICENSE_PRIVATE_KEY=$(cat /tmp/license-private-escaped.txt)" >> /etc/gym/license-server.env
echo "LICENSE_PUBLIC_KEY=$(cat /tmp/license-public-escaped.txt)" >> /etc/gym/license-server.env
chmod 600 /etc/gym/license-server.env
rm -f /tmp/license-private-escaped.txt /tmp/license-public-escaped.txt
```

Create frontend production env:

```bash
cat >/var/www/gym-management-system/frontend/.env.production <<'ENV'
VITE_API_BASE_URL=/api
VITE_LICENSE_SERVER_BASE_URL=https://license.example.com
VITE_ENABLE_CHECKIN_QR=false
ENV
chown gymapp:gymapp /var/www/gym-management-system/frontend/.env.production
```

Important:
- Do not use default secrets in production.
- If you already started license-server once before setting `ADMIN_USERNAME/ADMIN_PASSWORD`, the old admin may already exist in `licenses.db`.

---

## 10) Database + Build + Integrity Manifest
Backend Prisma setup:

```bash
cd /var/www/gym-management-system/backend
npx prisma generate
npx prisma db push
```

Build frontend:

```bash
cd /var/www/gym-management-system/frontend
npm run build
```

Generate release integrity manifest (from final frontend dist):

```bash
cd /var/www/gym-management-system
node scripts/generate-release-integrity-manifest.cjs
```

Sign manifest using private key:

```bash
export INTEGRITY_PRIVATE_KEY="$(awk '{printf "%s\\n",$0}' /etc/gym/keys/license-private.pem)"
cd /var/www/gym-management-system/license-server
npm run integrity:sign -- 1.0.0
unset INTEGRITY_PRIVATE_KEY
```

Note:
- `1.0.0` must match your app version in root `package.json`.
- If version changes, sign that exact version.

---

## 11) systemd Services
Create backend service:

```bash
cat >/etc/systemd/system/gym-backend.service <<'UNIT'
[Unit]
Description=Gym Backend API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=gymapp
Group=gymapp
WorkingDirectory=/var/www/gym-management-system/backend
EnvironmentFile=/etc/gym/backend.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
```

Create license-server service:

```bash
cat >/etc/systemd/system/gym-license-server.service <<'UNIT'
[Unit]
Description=Gym License Server
After=network.target

[Service]
Type=simple
User=gymapp
Group=gymapp
WorkingDirectory=/var/www/gym-management-system/license-server
EnvironmentFile=/etc/gym/license-server.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable --now gym-backend
systemctl enable --now gym-license-server
systemctl status gym-backend --no-pager
systemctl status gym-license-server --no-pager
```

---

## 12) Nginx Reverse Proxy
App site:

```bash
cat >/etc/nginx/sites-available/gym-app <<'NGINX'
server {
    listen 80;
    server_name app.example.com;

    root /var/www/gym-management-system/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
```

License site:

```bash
cat >/etc/nginx/sites-available/gym-license <<'NGINX'
server {
    listen 80;
    server_name license.example.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
```

Enable and test:

```bash
ln -sf /etc/nginx/sites-available/gym-app /etc/nginx/sites-enabled/gym-app
ln -sf /etc/nginx/sites-available/gym-license /etc/nginx/sites-enabled/gym-license
nginx -t
systemctl reload nginx
```

---

## 13) HTTPS (Let's Encrypt)
```bash
certbot --nginx -d app.example.com -d license.example.com --agree-tos -m you@example.com --redirect
systemctl status certbot.timer --no-pager
```

Test renew:

```bash
certbot renew --dry-run
```

---

## 14) First Smoke Test
```bash
curl -f https://app.example.com/api/health
curl -f https://license.example.com/health
curl -f https://license.example.com/api/licenses/public-key
curl -f "https://license.example.com/api/integrity/manifest?version=1.0.0"
```

Browser checks:
1. Open `https://app.example.com` -> login screen appears.
2. Login backend admin (`admin` / `admin123`) and immediately change password.
3. Open Support page in gym app -> vendor profile loads.
4. Open `https://license.example.com/admin/login` -> license admin login works.
5. Confirm device dashboard and vendor profile pages load.

---

## 15) Logs and Monitoring
systemd logs:

```bash
journalctl -u gym-backend -f
journalctl -u gym-license-server -f
```

App file logs:
- Backend: `/var/lib/gym-app/logs/backend-errors.log`
- License server: `/var/lib/gym-license/logs/license-server-errors.log`

Nginx logs:
- `/var/log/nginx/access.log`
- `/var/log/nginx/error.log`

---

## 16) Release Update Procedure
For each new deployment:

```bash
cd /var/www/gym-management-system
# update files (git pull or replace uploaded files)

cd backend
npm ci
npx prisma generate
npx prisma db push

cd ../frontend
npm ci
npm run build

cd ..
node scripts/generate-release-integrity-manifest.cjs

export INTEGRITY_PRIVATE_KEY="$(awk '{printf "%s\\n",$0}' /etc/gym/keys/license-private.pem)"
cd license-server
npm run integrity:sign -- <APP_VERSION>
unset INTEGRITY_PRIVATE_KEY

cd ..
systemctl restart gym-license-server
systemctl restart gym-backend
systemctl reload nginx
```

Replace `<APP_VERSION>` with root `package.json` version.

---

## 17) Rollback
If deployment fails:
1. Revert code to previous release folder/commit.
2. Rebuild frontend.
3. Regenerate and re-sign integrity manifest for rolled-back version.
4. Restart services:
   - `systemctl restart gym-license-server gym-backend`
5. Re-test health endpoints.

---

## 18) Security Checklist
1. Change all default passwords/secrets.
2. Keep `/etc/gym/*.env` readable only by root.
3. Keep private key (`/etc/gym/keys/license-private.pem`) at `600`.
4. Do not expose ports 3001/4000/5432 publicly.
5. Keep server updated: `apt update && apt upgrade`.
6. Backup:
   - PostgreSQL dump (`gymdb`)
   - `/var/lib/gym-license` (license SQLite + manifests + logs)
   - `/etc/gym` (env and keys)

---

## 19) Common Failures and Fixes
1. `INTEGRITY_MISMATCH` on activation/start:
   - Rebuild frontend.
   - Regenerate manifest.
   - Re-sign with correct private key.
   - Ensure `version` requested matches signed folder.

2. Backend starts but login fails with DB errors:
   - Check `DATABASE_URL`.
   - Run `npx prisma db push`.
   - Check postgres user/database permissions.

3. License admin login fails:
   - Verify `ADMIN_USERNAME/ADMIN_PASSWORD` in `/etc/gym/license-server.env`.
   - If DB already initialized with old admin, update record or re-seed credentials.

4. Support page cannot load vendor profile:
   - Verify `VITE_LICENSE_SERVER_BASE_URL` in `frontend/.env.production`.
   - Verify `https://license.example.com/api/public/vendor-profile`.

5. Frontend route refresh returns 404:
   - Ensure Nginx has `try_files $uri $uri/ /index.html;`.

---

## 20) Prompt Template for Codex on Server
Use this when you open a Codex session on the Ubuntu server:

```text
Read /var/www/gym-management-system/docs/RUNBOOK_UBUNTU_CLOUD.md and execute sections 4 through 14 end-to-end.
If any command fails, fix and continue.
Do not modify unrelated app logic.
Never commit runtime files (*.db, *.enc, logs, caches).
At the end, report:
1) service status
2) health endpoint results
3) final URLs and login checks
```

