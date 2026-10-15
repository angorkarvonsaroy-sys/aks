#!/usr/bin/env bash
# =====================================================================
#  AKS TIZIM — avto-yangilashni yoqish (bir marta ishga tushiriladi)
#  Tizim muallifi: Kamoliddin Naqiyev
#
#  Nima qiladi:
#   1. GitHub'dagi kodni serverga oladi (/opt/aks/repo)
#   2. Har daqiqada yangi kodni tekshiradigan taymer qo'yadi —
#      shundan keyin kod yangilanishi uchun serverga kirish shart emas
#   3. Birinchi o'rnatishni bajaradi: ko'zgu (Google jadval → baza) ishga tushadi
#  Qayta ishga tushirsa bo'ladi — bor narsani buzmaydi.
# =====================================================================
set -euo pipefail
trap 'echo; echo "!!! XATO: $LINENO-qatorda toxtadi: $BASH_COMMAND"' ERR
REPO=/opt/aks/repo

echo "--- 1/3 Kod olinmoqda"
command -v git   >/dev/null || apt-get install -y -q git
command -v rsync >/dev/null || apt-get install -y -q rsync
if [ -d "$REPO/.git" ]; then
  git -C "$REPO" fetch -q origin main && git -C "$REPO" reset -q --hard origin/main
else
  git clone -q https://github.com/angorkarvonsaroy-sys/aks "$REPO"
fi
echo "    $(git -C "$REPO" log -1 --format='%h %s')"

echo "--- 2/3 Avto-yangilash taymeri"
install -m 755 "$REPO/server/bin/aks-yangila" /usr/local/bin/aks-yangila
cp "$REPO"/server/systemd/aks-yangila.* /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q --now aks-yangila.timer

echo "--- 3/3 Birinchi o'rnatish (1–2 daqiqa)…"
/usr/local/bin/aks-yangila majburiy || { tail -30 /var/log/aks-deploy.log; exit 1; }
tail -6 /var/log/aks-deploy.log

echo "--- Ko'zgu birinchi marta ishlayapti, kutilmoqda…"
sleep 3
for i in $(seq 1 100); do
  [ "$(systemctl show -p ActiveState --value aks-kozgu.service)" = "activating" ] || break
  sleep 3
done
journalctl -u aks-kozgu.service -n 3 --no-pager -o cat 2>/dev/null || true
echo
/usr/local/bin/aks-holat
