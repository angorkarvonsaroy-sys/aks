-- AKS TIZIM — 009: SERVER SOZLAMALARI (02.11.2026, lib/sozlama.js). Eski tizim Script Properties'da saqlagan 3 ta sozlama endi shu yerda:
--   server_sozlama 'xat_zanjir' — XAT_ZANJIR (Xat.gs v25.7): {shartnoma: 'yyyy-MM-dd'} — muddati o'tgan qarz to'liq yopilib,
--                                 asosiy xatlar zanjiri qayta boshlangan kun. Belgini server qo'yadi (lib/xat_yordam.js xatZanjirBelgila).
--   server_sozlama 'top_qoida'  — TOP_QOIDA (Topshiriq.gs v2.2): {qoida: {on, kun}} — avto-topshiriq qoidalari (direktor o'zgartiradi).
--   qd_navbat                   — QD_NAVBAT_* (qdSnap_): xodimning bugungi ish navbati — kun boshidagi ro'yxat. 14 kundan eskisi tozalanadi.
-- Birinchi o'qishda qiymat yo'q bo'lsa — eski joydan (Redis nusxasi / ko'prik) BIR MARTA ko'chiriladi; keyin manba — faqat shu jadvallar.
SET client_min_messages = warning;
SET ROLE aks;

CREATE TABLE IF NOT EXISTS server_sozlama (
  kompaniya_id  int  NOT NULL DEFAULT 1,
  kalit         text NOT NULL,
  qiymat        jsonb NOT NULL,
  yangilandi    timestamptz NOT NULL DEFAULT now(),
  kim           text,      -- oxirgi yozgan: xodim F.I.Sh. | undPortfel | ko'chirish
  manba         text,      -- oxirgi yozuv manbai: server | eski:redis | eski:koprik | bosh
  PRIMARY KEY (kompaniya_id, kalit)
);

CREATE TABLE IF NOT EXISTS qd_navbat (
  kompaniya_id  int  NOT NULL DEFAULT 1,
  sana          date NOT NULL,
  fish          text NOT NULL,
  nolar         jsonb NOT NULL DEFAULT '[]',   -- ["27/123", …] — kun boshida navbatda bo'lgan shartnomalar
  yangilandi    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kompaniya_id, sana, fish)
);

RESET ROLE;
