-- AKS TIZIM — 001: asosiy tuzilma (ko'p mijozli) va Google jadvalning ko'zgusi.
-- Qayta-qayta ishga tushirsa bo'ladi (IF NOT EXISTS). Obyektlar egasi — aks.
SET client_min_messages = warning;
SET ROLE aks;

-- Kompaniyalar: tizimdan foydalanuvchi har bir biznes (multi-tenant).
CREATE TABLE IF NOT EXISTS kompaniyalar (
  id          serial PRIMARY KEY,
  nom         text NOT NULL UNIQUE,
  sheet_id    text,                     -- eski tizim jadvali (ko'zgu manbai); ko'chish tugagach NULL bo'ladi
  faol        boolean NOT NULL DEFAULT true,
  sozlamalar  jsonb   NOT NULL DEFAULT '{}'::jsonb,
  yaratilgan  timestamptz NOT NULL DEFAULT now()
);

CREATE SCHEMA IF NOT EXISTS kozgu;

-- Har varaqning oxirgi holati
CREATE TABLE IF NOT EXISTS kozgu.varaqlar (
  kompaniya_id int  NOT NULL REFERENCES kompaniyalar(id),
  varaq        text NOT NULL,
  qatorlar     int  NOT NULL DEFAULT 0,
  ustunlar     int  NOT NULL DEFAULT 0,
  xesh         text,
  ozgargan     timestamptz,             -- ma'lumot oxirgi marta o'zgargan payt
  tekshirilgan timestamptz,             -- oxirgi marta solishtirilgan payt
  PRIMARY KEY (kompaniya_id, varaq)
);

-- Varaq qatorlari: qator_no — Google jadvaldagi haqiqiy qator raqami (1 dan), data — katakchalar ro'yxati
CREATE TABLE IF NOT EXISTS kozgu.qatorlar (
  kompaniya_id int   NOT NULL,
  varaq        text  NOT NULL,
  qator_no     int   NOT NULL,
  data         jsonb NOT NULL,
  PRIMARY KEY (kompaniya_id, varaq, qator_no)
);

-- Har bir ko'chirish yurishining jurnali
CREATE TABLE IF NOT EXISTS kozgu.yurishlar (
  id            bigserial PRIMARY KEY,
  kompaniya_id  int,
  boshlandi     timestamptz NOT NULL DEFAULT now(),
  tugadi        timestamptz,
  holat         text NOT NULL DEFAULT 'ishlayapti',   -- ishlayapti | ok | xato
  varaqlar      int,
  ozgargan      int,
  qatorlar      int,
  google_ms     int,
  baza_ms       int,
  xato          text
);
CREATE INDEX IF NOT EXISTS yurishlar_vaqt ON kozgu.yurishlar (boshlandi DESC);

INSERT INTO kompaniyalar (nom, sheet_id)
VALUES ('Angor Karvon Saroy', '1qqBgS99WeIVEq_BwQ4-qdUWpRoGAKJpUum86aCDSJJE')
ON CONFLICT (nom) DO NOTHING;

RESET ROLE;
