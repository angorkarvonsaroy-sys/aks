-- AKS TIZIM — 006: xodimning kirish paroli izi va Gmail manzili (direktor qarori 01.11.2026).
-- Kirish endi: TELEFON RAQAM + PAROL. Parolga hech qanday shart yo'q (1 ta belgi ham bo'ladi) — shuning uchun parol
-- endi xodimni TANIMAYDI (ikki xodimda bir xil parol bo'lishi mumkin), uni telefon raqami taniydi.
-- Parolning o'zi hech qayerda saqlanmaydi — faqat izi (scrypt, har xodimga alohida tuz). Google jadvalga yozilmaydi.
-- 07_Xodimlar L (kirish kodi) endi xodim teradigan narsa emas — qurilmada saqlanadigan uzun tasodifiy kalit (havoladagi ?k=…).
SET client_min_messages = warning;
SET ROLE aks;

CREATE TABLE IF NOT EXISTS xodim_kirish (
  kompaniya_id int  NOT NULL DEFAULT 1,
  xodim_id     text NOT NULL,                 -- 07_Xodimlar A (Xodim_ID)
  parol_iz     text,                          -- s1$<tuz hex>$<iz hex> (scrypt)
  parol_vaqt   timestamptz,
  gmail        text,
  gmail_vaqt   timestamptz,
  gmail_kim    text,                          -- «o'zi (tasdiqlangan)» yoki direktor F.I.Sh.
  PRIMARY KEY (kompaniya_id, xodim_id)
);

RESET ROLE;
