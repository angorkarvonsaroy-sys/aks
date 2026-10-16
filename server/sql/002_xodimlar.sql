-- AKS TIZIM — 002: xodimlar va huquqlar — ko'zgudagi 07_Xodimlar varag'idan ko'rinish (view).
-- Ko'zgu yangilangani zahoti bu ko'rinish ham yangi bo'ladi (nusxa saqlanmaydi).
-- 07_Xodimlar ustunlari (0 dan): A=Xodim_ID, B=FISH, D=Lavozim, F=Telefon, K=Holat («Ishlayapti»), L=Kirish_kodi,
--   S=Huquqlar (vergul bilan), T=PIN (tuz:sha256), U=Telegram_ID  (Kod.gs foydalanuvchiKod_, Pin.gs PIN_T=20, PIN_U=21)
SET client_min_messages = warning;
SET ROLE aks;

CREATE OR REPLACE VIEW v_xodimlar AS
SELECT
  q.kompaniya_id,
  q.qator_no,
  regexp_replace(coalesce(q.data->>0, ''), '\.0$', '')           AS xodim_id,
  btrim(coalesce(q.data->>1, ''))                                  AS fish,
  coalesce(q.data->>3, '')                                         AS lavozim,
  regexp_replace(coalesce(q.data->>5, ''), '\D', '', 'g')          AS tel_raqam,      -- faqat raqamlar
  btrim(coalesce(q.data->>10, ''))                                 AS holat,
  btrim(coalesce(q.data->>11, ''))                                 AS kirish_kodi,
  lower(coalesce(q.data->>18, ''))                                 AS huquq_matn,
  (SELECT array_agg(btrim(h)) FROM unnest(string_to_array(lower(coalesce(q.data->>18, '')), ',')) h WHERE btrim(h) <> '')
                                                                   AS huquqlar,
  coalesce(q.data->>19, '')                                        AS pin_iz,
  coalesce(q.data->>20, '')                                        AS telegram_id
FROM kozgu.qatorlar q
WHERE q.varaq = '07_Xodimlar' AND q.qator_no >= 2 AND coalesce(q.data->>0, '') <> '';

COMMENT ON VIEW v_xodimlar IS 'Xodimlar — 07_Xodimlar varag''ining ko''rinishi (ko''zgu orqali, faqat o''qish)';

RESET ROLE;
