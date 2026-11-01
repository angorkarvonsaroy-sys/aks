-- AKS TIZIM — 008: baza ko'chirishi, 3-bosqich — IKKI TOMONLAMA YOZISH jurnali (02.11.2026, lib/ikki_yozuv.js).
-- Server Google jadvalga yozgan har o'zgarish «baza» ga qo'llanganda shu yerga bitta qator (varaq bo'yicha): kim (amal), qaysi qatorlar/ustunlar,
-- natija (ok | ogoh | xato | tashqari) va yozilgan xom qiymatlar (kataklar — tiklashda qayta qo'llash va xatoni topish uchun). 45 kundan eskisi tozalanadi.
SET client_min_messages = warning;
SET ROLE aks;

CREATE TABLE IF NOT EXISTS baza_ikki_jurnal (
  id            bigserial PRIMARY KEY,
  vaqt          timestamptz NOT NULL DEFAULT now(),
  kompaniya_id  int,
  amal          text,      -- api amali (fn) | vaqt:<ish> | tg | fon | bin:<buyruq>
  varaq         text,
  jadval        text,      -- «baza» dagi jadval (sxemada bo'lmasa NULL)
  qatorlar      int[],
  ustunlar      text[],
  soni          int,       -- kataklar soni
  holat         text NOT NULL,   -- ok | ogoh (qo'llandi, lekin izoh bor) | xato (qo'llanmadi) | tashqari (varaq sxemada yo'q)
  xato          text,
  kataklar      jsonb,     -- [[qator, harf, xom], …] yoki {"surish": [bosh, soni]} yoki {"lugat": true}
  ms            int
);
CREATE INDEX IF NOT EXISTS baza_ikki_jurnal_vaqt ON baza_ikki_jurnal (vaqt);
CREATE INDEX IF NOT EXISTS baza_ikki_jurnal_jadval ON baza_ikki_jurnal (jadval, vaqt);

RESET ROLE;
