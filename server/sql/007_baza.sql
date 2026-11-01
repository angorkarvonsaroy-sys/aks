-- AKS TIZIM — 007: baza ko'chirishi (1-bosqich) jurnali. «baza» sxemasining o'zini `aks-baza toldir` har safar
-- qaytadan quradi (lib/baza.js, lib/baza_sxema.js) — shuning uchun bu yerda faqat sxema almashganda ham saqlanadigan jurnal.
SET client_min_messages = warning;
SET ROLE aks;

CREATE TABLE IF NOT EXISTS baza_yuklashlar (
  id         bigserial PRIMARY KEY,
  boshlandi  timestamptz NOT NULL DEFAULT now(),
  tugadi     timestamptz,
  holat      text NOT NULL DEFAULT 'ishlayapti',   -- ishlayapti | ok | xato
  ms         int,
  hisobot    jsonb,
  xato_matn  text
);

RESET ROLE;
