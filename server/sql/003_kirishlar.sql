-- AKS TIZIM — 003: ilovaga kirishlar jurnali (server orqali kirganlar). 07b_Kirish_jurnali ning serverdagi o'rni.
SET client_min_messages = warning;
SET ROLE aks;

CREATE TABLE IF NOT EXISTS kirishlar (
  id           bigserial PRIMARY KEY,
  kompaniya_id int  NOT NULL DEFAULT 1,
  xodim_id     text,
  fish         text NOT NULL,
  usul         text NOT NULL,                 -- PIN | PIN o'rnatildi | bilet
  vaqt         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kirishlar_vaqt ON kirishlar (kompaniya_id, vaqt DESC);

RESET ROLE;
