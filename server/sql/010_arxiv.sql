-- AKS TIZIM — 010: ARXIV (02.11.2026, lib/arxiv.js). Server fayllarni direktor Drive'idagi «AKS TIZIM / AKS ARXIV» papkasiga o'zi yuklaydi
-- (rclone, direktor hisobi, ruxsat — faqat o'zi yaratgan fayllar: drive.file). Eski tizim (Koprik) Drive yordamchilari o'rniga.
--   arxiv_fayllar — server yuklagan har fayl: Drive ID ↔ arxivdagi yo'li (savatga tashlash, ko'chirish va tiklash yo'l bo'yicha qilinadi).
-- Eski tizim yaratgan fayllar bu jadvalda yo'q — ularga avvalgidek eski tizim orqali (ko'prik bor ekan) tegiladi.
SET client_min_messages = warning;
SET ROLE aks;

CREATE TABLE IF NOT EXISTS arxiv_fayllar (
  id          text PRIMARY KEY,          -- Drive fayl ID
  yol         text NOT NULL,             -- «AKS ARXIV» ichidagi yo'l: '06 XATLAR/2026/OG-2026-0012.pdf'
  asl_yol     text,                      -- ko'chirilgan bo'lsa (bekor papkasiga) — avvalgi yo'li (tiklash uchun)
  hajm        bigint,
  savatda     boolean NOT NULL DEFAULT false,
  yaratildi   timestamptz NOT NULL DEFAULT now(),
  yangilandi  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arxiv_fayllar_yol ON arxiv_fayllar (yol);

RESET ROLE;
