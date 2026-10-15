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
cp "$APP"/systemd/*.service "$APP"/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q --now aks-yangila.timer aks-kozgu.timer

# 5. ko'zguni darhol bir marta yurgizish (kutmasdan)
systemctl start --no-block aks-kozgu.service

git -C "$REPO" rev-parse HEAD >"$APP/.versiya"
echo "=== o'rnatildi: $(cat "$APP/.versiya" | cut -c1-7) ==="
