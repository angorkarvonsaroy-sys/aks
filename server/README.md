# AKS TIZIM — server qismi

Tizim muallifi va yaratuvchisi: **Kamoliddin Naqiyev**

Bu papkadagi kod Toshkentdagi serverda (`aks-tizim`, 89.31.28.213) ishlaydi.
Sirlar (parollar, Google robot kaliti, ko'prik kaliti) bu yerda **yo'q** — ular faqat serverda: `/opt/aks/.env`, `/opt/aks/google-key.json`.
Xodimlar ilovasi (`Index.html`, `Xarita.html`) ham faqat serverda: `/opt/aks/private/`.

## Qanday yangilanadi

`aks-yangila.timer` har daqiqada GitHub'dagi `main` ni tekshiradi. Yangi kod bo'lsa — `deploy.sh`:
kod `/opt/aks/app` ga ko'chadi, kutubxonalar o'rnatiladi, `sql/*.sql` bazaga qo'llanadi, taymerlar yangilanadi,
ilova serveri (`pm2: aks-api`) qayta yuklanadi. Jurnal: `/var/log/aks-deploy.log`.

Birinchi marta (bir martalik): `curl -fsSL https://raw.githubusercontent.com/angorkarvonsaroy-sys/aks/main/server/ornat.sh | bash`

## Qismlar

| Qism | Nima qiladi |
|---|---|
| `kozgu.js` | **Ko'zgu.** Har 5 daqiqada AKS_BAZA ning hamma varaqlarini Google Sheets API orqali **faqat o'qiydi** va `kozgu.qatorlar` ga yozadi (faqat o'zgargan varaqlar, bitta tranzaksiya). |
| `api/` | **Ilova serveri** (Fastify, 127.0.0.1:3000, Nginx orqasida). `GET /?k=KOD` — Index.html (shablon to'ldirilib, boshiga ko'prik skripti qo'shilib). `POST /api/rpc {fn,args}` — eski `google.script.run` chaqiruvlarining o'rni. `GET /api/holat`. |
| `api/amallar.js` | Serverda bajariladigan amallar: `pinHolat`, `pinKir`, `pinTirik` (PIN izi eski tizim bilan bir xil — xodimlar PIN'i o'zgarmaydi), `menKimman`. Ro'yxatda yo'q amal → ko'prik. |
| `api/koprik.js` + `appsscript/Koprik.gs` | **Eski tizim ko'prigi.** Serverga hali ko'chirilmagan amal Apps Script'dagi `doPost` orqali eski kodda bajariladi. Server: `.env` da `BRIDGE_URL` (…/exec) va `BRIDGE_SECRET`; Apps Script: `Koprik.gs` + Script Properties `BRIDGE_SECRET`. |
| `sql/` | `001` kompaniyalar + ko'zgu jadvallari · `002` `v_xodimlar` (07_Xodimlar ko'rinishi) · `003` `kirishlar` · `004` `rpc_jurnal` + `v_rpc_24soat` (qaysi amal qayerda, necha ms). |

## Server buyruqlari

| Buyruq | Nima qiladi |
|---|---|
| `aks-holat` | umumiy holat: versiya, xotira, ilova serveri, ko'zgu, so'rovlar tezligi |
| `aks-kozgu` | ko'zguni hozir qo'lda yurgizish |
| `aks-yangila majburiy` | kodni qayta o'rnatish |
| `sudo -u aks pm2 logs aks-api` | ilova serveri jurnali |
