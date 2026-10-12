#!/usr/bin/env bash
# =====================================================================
#  AKS TIZIM — server sozlash (1-bosqich)        Ubuntu 24.04, v1.0
#  Tizim muallifi: Kamoliddin Naqiyev
#
#  Nima qiladi (hammasi avtomatik, savol bermaydi):
#   1. Tizimni yangilaydi, vaqt zonasini Toshkentga qo'yadi
#   2. Himoya devori (ufw): faqat 22, 2222, 80, 443 ochiq
#   3. fail2ban: parolni ko'p marta xato tergan IP bloklanadi
#   4. PostgreSQL 16 — ma'lumotlar bazasi (aks_tizim)
#   5. Redis — tezkor kesh
#   6. Node.js 22 + pm2 — ilova serveri
#   7. Nginx — tashqi eshik (keyin HTTPS shu yerga qo'yiladi)
#   8. Har kecha 03:00 da baza zaxirasi (/var/backups/aks, 14 kun)
#   9. Xavfsizlik yangilanishlari avtomatik o'rnatiladi
#  Parollar /root/aks.env faylida saqlanadi (faqat root o'qiydi).
#  Qayta ishga tushirsa bo'ladi — bor narsani buzmaydi.
# =====================================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
LOG=/root/aks-setup.log
exec > >(tee -a "$LOG") 2>&1
echo "=== AKS TIZIM setup boshlandi: $(date) ==="

step() { echo; echo "---------- $1"; }

# ---------- 1. tizim
step "1/9 Tizim yangilanmoqda"
apt-get update -q
apt-get -y -q -o Dpkg::Options::="--force-confold" upgrade
apt-get install -y -q curl wget gnupg ca-certificates lsb-release ufw fail2ban unzip htop
timedatectl set-timezone Asia/Tashkent || true

# ---------- 2. himoya devori
step "2/9 Himoya devori (ufw)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 2222/tcp  comment 'SSH-2'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'
ufw --force enable
ufw status | head -20

# ---------- 3. fail2ban
step "3/9 fail2ban"
cat >/etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
[sshd]
enabled = true
port    = 22,2222
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ---------- 4. PostgreSQL
step "4/9 PostgreSQL 16"
apt-get install -y -q postgresql postgresql-contrib
systemctl enable --now postgresql
ENV=/root/aks.env
if [ -f "$ENV" ]; then
  # shellcheck disable=SC1090
  . "$ENV"
fi
if [ -z "${DB_PASS:-}" ]; then
  DB_PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='aks') THEN
    CREATE ROLE aks LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE aks WITH PASSWORD '$DB_PASS';
  END IF;
END \$\$;
EOF
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='aks_tizim'" | grep -q 1; then
  sudo -u postgres createdb -O aks -E UTF8 aks_tizim
fi
# ishlash tezligi uchun asosiy sozlamalar (8 GB RAM uchun)
PGCONF=$(sudo -u postgres psql -tAc 'SHOW config_file')
PGDIR=$(dirname "$PGCONF")
mkdir -p "$PGDIR/conf.d" && chown postgres:postgres "$PGDIR/conf.d"
grep -q "^include_dir = 'conf.d'" "$PGCONF" || echo "include_dir = 'conf.d'" >>"$PGCONF"
cat >"$PGDIR/conf.d/aks.conf" <<'EOF2'
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 32MB
maintenance_work_mem = 256MB
timezone = 'Asia/Tashkent'
log_timezone = 'Asia/Tashkent'
EOF2
chown postgres:postgres "$PGDIR/conf.d/aks.conf"
systemctl restart postgresql
PGVER=$(sudo -u postgres psql -tAc 'SHOW server_version' | cut -d. -f1)

# ---------- 5. Redis
step "5/9 Redis"
apt-get install -y -q redis-server
sed -i 's/^supervised .*/supervised systemd/' /etc/redis/redis.conf
grep -q '^maxmemory ' /etc/redis/redis.conf || echo 'maxmemory 512mb' >>/etc/redis/redis.conf
grep -q '^maxmemory-policy ' /etc/redis/redis.conf || echo 'maxmemory-policy allkeys-lru' >>/etc/redis/redis.conf
systemctl enable --now redis-server
systemctl restart redis-server

# ---------- 6. Node.js + pm2
step "6/9 Node.js 22 + pm2"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" != "22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
npm install -g pm2 >/dev/null
id -u aks >/dev/null 2>&1 || useradd -m -s /bin/bash aks
mkdir -p /opt/aks && chown aks:aks /opt/aks
pm2 startup systemd -u aks --hp /home/aks >/dev/null 2>&1 || true

# ---------- 7. Nginx
step "7/9 Nginx"
apt-get install -y -q nginx
cat >/etc/nginx/sites-available/aks <<'EOF'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 50m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
    location = /holat { return 200 "AKS TIZIM server ishlayapti\n"; add_header Content-Type text/plain; }
}
EOF
ln -sf /etc/nginx/sites-available/aks /etc/nginx/sites-enabled/aks
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx

# ---------- 8. zaxira
step "8/9 Har kungi zaxira"
mkdir -p /var/backups/aks && chmod 700 /var/backups/aks
cat >/usr/local/bin/aks-backup <<'EOF'
#!/usr/bin/env bash
set -e
D=/var/backups/aks; mkdir -p $D
F=$D/aks_tizim_$(date +%F_%H%M).sql.gz
sudo -u postgres pg_dump aks_tizim | gzip -9 >"$F"
find $D -name '*.sql.gz' -mtime +14 -delete
echo "$(date) zaxira: $F $(du -h "$F" | cut -f1)" >>$D/backup.log
EOF
chmod +x /usr/local/bin/aks-backup
( crontab -l 2>/dev/null | grep -v aks-backup; echo "0 3 * * * /usr/local/bin/aks-backup" ) | crontab -
/usr/local/bin/aks-backup

# ---------- 9. avtomatik xavfsizlik yangilanishlari
step "9/9 Avtomatik yangilanishlar"
apt-get install -y -q unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# ---------- parollar fayli
cat >"$ENV" <<EOF
# AKS TIZIM — server sozlamalari (faqat root). Yaratildi: $(date)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=aks_tizim
DB_USER=aks
DB_PASS=$DB_PASS
REDIS_URL=redis://127.0.0.1:6379
APP_PORT=3000
EOF
chmod 600 "$ENV"
cp "$ENV" /opt/aks/.env && chown aks:aks /opt/aks/.env && chmod 600 /opt/aks/.env

# ---------- yakun
echo
echo "=============================================="
echo "  AKS TIZIM server TAYYOR   $(date '+%d.%m.%Y %H:%M')"
echo "=============================================="
echo "  Ubuntu     : $(lsb_release -ds)"
echo "  PostgreSQL : $PGVER  — baza aks_tizim, foydalanuvchi aks"
echo "  Redis      : $(redis-cli ping 2>/dev/null || echo 'xato')"
echo "  Node.js    : $(node -v)   pm2: $(pm2 -v)"
echo "  Nginx      : $(systemctl is-active nginx)  → http://$(curl -s4 -m 5 ifconfig.me || hostname -I | awk '{print $1}')/holat"
echo "  Firewall   : $(ufw status | head -1)"
echo "  fail2ban   : $(systemctl is-active fail2ban)"
echo "  Zaxira     : har kuni 03:00 → /var/backups/aks ($(ls /var/backups/aks/*.sql.gz 2>/dev/null | wc -l) ta fayl)"
echo "  Parollar   : /root/aks.env"
echo "  Jurnal     : $LOG"
echo "=============================================="
