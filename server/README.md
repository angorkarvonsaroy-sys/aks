# AKS TIZIM — server qismi

Tizim muallifi va yaratuvchisi: **Kamoliddin Naqiyev**

Bu papkadagi kod Toshkentdagi serverda (`aks-tizim`, 89.31.28.213) ishlaydi.
Sirlar (parollar, Google robot kaliti) bu yerda **yo'q** — ular faqat serverda: `/opt/aks/.env`, `/opt/aks/google-key.json`.

## Qanday yangilanadi

`aks-yangila.timer` har daqiqada GitHub'dagi `main` ni tekshiradi. Yangi kod bo'lsa — `deploy.sh` ishga tushadi:
kod `/opt/aks/app` ga ko'chadi, kutubxonalar o'rnatiladi, `sql/*.sql` bazaga qo'llanadi, taymerlar yangilanadi.
Jurnal: `/var/log/aks-deploy.log`.

Birinchi marta (bir martalik): `curl -fsSL https://raw.githubusercontent.com/angorkarvonsaroy-sys/aks/main/server/ornat.sh | bash`

## Ko'zgu (1-bosqich)

`kozgu.js` har 5 daqiqada AKS_BAZA ning hamma varaqlarini Google Sheets API orqali **faqat o'qiydi**
va `kozgu.qatorlar` jadvaliga yozadi. Faqat o'zgargan varaqlar qayta yoziladi, hammasi bitta tranzaksiyada.

## Server buyruqlari

| Buyruq | Nima qiladi |
|---|---|
| `aks-holat` | serverning umumiy holati: versiya, xotira, ko'zgu natijalari |
| `aks-kozgu` | ko'zguni hozir qo'lda yurgizish |
| `aks-yangila majburiy` | kodni qayta o'rnatish |
