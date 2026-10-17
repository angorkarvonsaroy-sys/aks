#!/usr/bin/env bash
# AKS TIZIM — yangi kodni o'rnatish. aks-yangila chaqiradi (root sifatida).
# Bir necha marta ishga tushsa ham bor narsani buzmaydi.
set -euo pipefail
trap 'echo "!!! deploy.sh $LINENO-qatorda toxtadi: $BASH_COMMAND"' ERR
REPO=/opt/aks/repo
APP=/opt/aks/app
echo
echo "=== $(date '+%F %T') o'rnatish: $(git -C "$REPO" log -1 --format='%h %s') ==="

command -v rsync >/dev/null || apt-get install -y -q rsync >/dev/null

# 1. kodni ilova papkasiga ko'chirish (node_modules saqlanadi)
mkdir -p "$APP"
rsync -a --delete --exclude node_modules --exclude package-lock.json --exclude .versiya "$REPO/server/" "$APP/"
chown -R aks:aks "$APP"

# 2. kutubxonalar
cd "$APP"
sudo -u aks -H npm install --omit=dev --no-audit --no-fund --loglevel=error

# 3. baza tuzilmasi (har fayl qayta-qayta ishga tushsa bo'ladi)
for f in "$APP"/sql/*.sql; do
  echo "  baza: $(basename "$f")"
  sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d aks_tizim -f "$f"
done

# 4. buyruqlar va taymerlar
install -m 755 "$APP/bin/aks-yangila" /usr/local/bin/aks-yangila
install -m 755 "$APP/bin/aks-holat"   /usr/local/bin/aks-holat
install -m 755 "$APP/bin/aks-kozgu"   /usr/local/bin/aks-kozgu
install -m 755 "$APP/bin/aks-bugun"   /usr/local/bin/aks-bugun
install -m 755 "$APP/bin/aks-solishtir" /usr/local/bin/aks-solishtir
install -m 755 "$APP/bin/aks-yurist"  /usr/local/bin/aks-yurist
cp "$APP"/systemd/*.service "$APP"/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q --now aks-yangila.timer aks-kozgu.timer

# 4b. Nginx: katta skan (25 MB → base64 34 MB) o'tsin, eski tizim javobini 5 daqiqagacha kutsin
cat > /etc/nginx/conf.d/aks-yuklash.conf <<'NG'
client_max_body_size 64m;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
NG
nginx -t -q && systemctl reload nginx || echo "!!! nginx sozlamasi qabul qilinmadi"

# 5. ko'zguni darhol bir marta yurgizish (kutmasdan)
systemctl start --no-block aks-kozgu.service

# 6. ilova serveri (pm2, aks foydalanuvchisi) — yangi kod bilan qayta yuklanadi
mkdir -p /opt/aks/private && chown -R aks:aks /opt/aks/private && chmod 750 /opt/aks/private
git -C "$REPO" rev-parse HEAD >"$APP/.versiya"
chown aks:aks "$APP/.versiya"
sudo -u aks -H bash -c "cd $APP && pm2 startOrReload ecosystem.config.js --update-env >/dev/null && pm2 save >/dev/null"
sleep 2
if curl -fsS -m 5 http://127.0.0.1:3000/api/holat >/dev/null; then echo "  api: ishlayapti"; else echo "  !!! api javob bermayapti"; sudo -u aks -H pm2 logs aks-api --lines 20 --nostream || true; rm -f "$APP/.versiya"; exit 1; fi
# pm2 server qayta yonganda o'zi ko'tarilsin (bir marta ro'yxatdan o'tadi)
systemctl is-enabled -q pm2-aks 2>/dev/null || { env PATH=$PATH:/usr/bin pm2 startup systemd -u aks --hp /home/aks >/dev/null 2>&1 || true; }
echo "=== o'rnatildi: $(cat "$APP/.versiya" | cut -c1-7) ==="
