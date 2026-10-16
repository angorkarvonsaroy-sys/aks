-- AKS TIZIM — 004: har bir ilova so'rovining vaqti (qaysi amal qayerda, necha ms) — tezlikni o'lchash va navbat belgilash uchun
SET client_min_messages = warning;
SET ROLE aks;

CREATE TABLE IF NOT EXISTS rpc_jurnal (
  id        bigserial PRIMARY KEY,
  vaqt      timestamptz NOT NULL DEFAULT now(),
  fn        text NOT NULL,
  qayerda   text NOT NULL,          -- server | koprik
  ms        int  NOT NULL,
  ok        boolean NOT NULL,
  xato      text
);
CREATE INDEX IF NOT EXISTS rpc_jurnal_vaqt ON rpc_jurnal (vaqt DESC);

-- aks-holat uchun: oxirgi 24 soatda amallar bo'yicha o'rtacha vaqt
CREATE OR REPLACE VIEW v_rpc_24soat AS
SELECT fn, qayerda, count(*) AS soni, round(avg(ms)) AS ortacha_ms, max(ms) AS eng_sekin_ms,
       count(*) FILTER (WHERE NOT ok) AS xatolar
FROM rpc_jurnal WHERE vaqt > now() - interval '24 hours'
GROUP BY fn, qayerda ORDER BY soni DESC;

RESET ROLE;
