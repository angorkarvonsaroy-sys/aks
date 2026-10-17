-- AKS TIZIM — 005: ko'zguda katakning ko'ringan matni ham saqlanadi (eski kod getDisplayValues ishlatgan joylar uchun).
-- data — xom qiymat (raqam, sana seriya raqami); korinish — katakda ko'ringan matn («12.05.2026», «1 234 567»).
SET client_min_messages = warning;
SET ROLE aks;
ALTER TABLE kozgu.qatorlar ADD COLUMN IF NOT EXISTS korinish jsonb;
-- bir marta: hamma varaq qayta o'qilsin (xesh eski formatda)
UPDATE kozgu.varaqlar SET xesh = '' WHERE xesh IS NOT NULL AND xesh <> '' AND NOT EXISTS (SELECT 1 FROM kozgu.qatorlar q WHERE q.kompaniya_id = kozgu.varaqlar.kompaniya_id AND q.varaq = kozgu.varaqlar.varaq AND q.korinish IS NOT NULL LIMIT 1);
RESET ROLE;
