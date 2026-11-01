// AKS TIZIM — BAZA KO'CHIRISHI, 2-bosqich: Google formulalari → PostgreSQL view (01.11.2026).
// «baza» jadvallari ustida — Google jadvaldagi formulalar bilan AYNAN bir xil natija berishi shart (aks-baza solishtir — har qator).
// View'lar `aks-baza toldir` ichida jadvallar bilan birga quriladi (sxema har safar qaytadan quriladi).
//
// Google Sheets xatti-harakati shu yerda takrorlanadi:
//   • hisob — ikkilik son (double, float8) bilan; ROUND — o'nlik ko'rinishdan, yarmi noldan uzoqqa (float8 → numeric → round);
//   • matn tengligi (SUMIFS / MATCH / «=») — katta-kichik harf farqsiz (lower);
//   • bo'sh katak: hisobda 0 (N()), natija «""» bo'lsa — NULL;
//   • INDEX/MATCH — birinchi mos qator (varaq tartibida);
//   • BUGUN (08_Lugatlar!Z2) — `SET aks.bugun = 'YYYY-MM-DD'` bilan beriladi (solishtirishda varaqdagi Z2), bo'lmasa — Toshkent bugungi sanasi.
'use strict';

const BUGUN = `coalesce(nullif(current_setting('aks.bugun', true), '')::date, (now() AT TIME ZONE 'Asia/Tashkent')::date)`;
const FAOL = `('aktiv', 'passiv', 'kredit asosida', 'shartnoma olmagan', 'yakunlangan', 'sudga berish')`;

function sql(S) {
  return [
// ---------------------------------------------------------------- 03b F «Kumulyativ»
// =IF($B2="","",IF($B2=$B1,$F1+$E2,$E2)) — varaq tartibida KETMA-KET kelgan bir xil shartnoma qatorlari yig'indisi.
// Oldingi qator bo'sh bo'lsa (qator raqami uzilgan) yoki boshqa shartnoma — yangi «orol».
`CREATE VIEW ${S}.tolov_jadvali_kum AS
WITH t AS (
  SELECT j.*, lag(j.shartnoma_no) OVER w AS old_no, lag(j.qator) OVER w AS old_qator
  FROM ${S}.tolov_jadvali j WINDOW w AS (PARTITION BY j.kompaniya_id ORDER BY j.qator)
), o AS (
  SELECT t.*, sum(CASE WHEN t.old_qator = t.qator - 1 AND t.old_no IS NOT NULL AND t.shartnoma_no IS NOT NULL
                        AND lower(t.old_no) = lower(t.shartnoma_no) THEN 0 ELSE 1 END)
              OVER (PARTITION BY t.kompaniya_id ORDER BY t.qator) AS orol
  FROM t
)
SELECT o.kompaniya_id, o.qator, o.jadval_id, o.shartnoma_no, o.tartib, o.sana, o.summa, o.turi,
  CASE WHEN o.shartnoma_no IS NULL THEN NULL
       ELSE sum(coalesce(o.summa, 0)) OVER (PARTITION BY o.kompaniya_id, o.orol ORDER BY o.qator) END AS kumulyativ
FROM o`,
`COMMENT ON VIEW ${S}.tolov_jadvali_kum IS '03b_Tolov_jadvali + F Kumulyativ (Google formulasi bilan bir xil)'`,

// ---------------------------------------------------------------- 03 sotuv shartnomasi hisoblari (V, W … AG, AJ)
`CREATE VIEW ${S}.sotuv_hisob AS
WITH mi AS (SELECT DISTINCT ON (kompaniya_id, mijoz_id) kompaniya_id, mijoz_id, fish FROM ${S}.mijozlar WHERE mijoz_id IS NOT NULL ORDER BY kompaniya_id, mijoz_id, qator),
dk AS (SELECT DISTINCT ON (kompaniya_id, lower(dokon_id)) kompaniya_id, lower(dokon_id) AS k, real_maydon FROM ${S}.dokonlar WHERE dokon_id IS NOT NULL ORDER BY kompaniya_id, lower(dokon_id), qator),
tl AS (SELECT kompaniya_id, lower(shartnoma_no) AS k, sum(summa)::float8 AS s FROM ${S}.tolovlar WHERE shartnoma_no IS NOT NULL GROUP BY 1, 2),
bf AS (SELECT kompaniya_id, lower(shartnoma_no) AS k, sum(summa)::float8 AS s FROM ${S}.bufer_tolovlar
       WHERE shartnoma_no IS NOT NULL AND lower(holati) = lower('Буферда') GROUP BY 1, 2),
jb AS (SELECT kompaniya_id, lower(shartnoma_no) AS k, sum(summa)::float8 AS s FROM ${S}.tolov_jadvali
       WHERE shartnoma_no IS NOT NULL AND sana <= ${BUGUN} GROUP BY 1, 2),
s AS (
  SELECT s.kompaniya_id, s.qator, s.shartnoma_no, s.holati, s.mijoz_id, s.dokon_id, s.shartnoma_sana, s.undiruvchi,
    mi.fish AS u,                                                    -- U: =IFERROR(INDEX('02_Mijozlar'!C, MATCH(E2, '02_Mijozlar'!A, 0)), "")
    s.shartnoma_maydon::float8 AS g, s.shartnoma_1m2_narx::float8 AS h, s.boshlangich_summa::float8 AS j, s.muddatli_oy::float8 AS l,
    dk.real_maydon::float8 AS v,                                     -- V: =IFERROR(INDEX('01_Dokonlar'!F, MATCH(F2, '01_Dokonlar'!A, 0)), "")
    coalesce(tl.s, 0) + coalesce(bf.s, 0) AS ab,                     -- AB: =SUMIFS(05.D,05.C,A2) + SUMIFS(05b.D,05b.C,A2,05b.G,"Буферда")
    coalesce(jb.s, 0) AS jadval_bugungacha,                          -- AF uchun: =SUMIFS(03b.E, 03b.B, A2, 03b.D, "<="&BUGUN)
    CASE WHEN lower(s.holati) IN ${FAOL} THEN 1 ELSE 0 END AS aj
  FROM ${S}.sotuv_shartnomalar s
  LEFT JOIN mi ON mi.kompaniya_id = s.kompaniya_id AND mi.mijoz_id = s.mijoz_id
  LEFT JOIN dk ON dk.kompaniya_id = s.kompaniya_id AND dk.k = lower(s.dokon_id)
  LEFT JOIN tl ON tl.kompaniya_id = s.kompaniya_id AND tl.k = lower(s.shartnoma_no)
  LEFT JOIN bf ON bf.kompaniya_id = s.kompaniya_id AND bf.k = lower(s.shartnoma_no)
  LEFT JOIN jb ON jb.kompaniya_id = s.kompaniya_id AND jb.k = lower(s.shartnoma_no)
), w AS (
  SELECT s.*,
    CASE WHEN g IS NULL OR h IS NULL THEN NULL ELSE round((g * h)::numeric, 0)::float8 END AS w,          -- W =ROUND(G*H,0)
    CASE WHEN v IS NULL OR g IS NULL THEN NULL ELSE round((v - g)::numeric, 2)::float8 END AS x           -- X =ROUND(V-G,2)
  FROM s
), y AS (
  SELECT w.*,
    CASE WHEN x IS NULL OR h IS NULL THEN NULL ELSE round((x * h)::numeric, 0)::float8 END AS y,          -- Y =ROUND(X*H,0)
    CASE WHEN w IS NULL OR l IS NULL OR l = 0 THEN NULL ELSE round(((w - coalesce(j, 0)) / l)::numeric, 0)::float8 END AS aa   -- AA
  FROM w
), z AS (
  SELECT y.*, CASE WHEN w IS NULL THEN NULL ELSE w + coalesce(y, 0) END AS z                                 -- Z =W+Y
  FROM y
), q AS (
  SELECT z.*,
    CASE WHEN w IS NULL THEN NULL ELSE greatest(0, w - ab) END AS ac,                                       -- AC =MAX(0,W-AB)
    CASE WHEN y IS NULL THEN NULL ELSE greatest(0, y - greatest(0, ab - w)) END AS ad,                       -- AD
    CASE WHEN z IS NULL THEN NULL ELSE z - ab END AS ae                                                    -- AE =Z-AB
  FROM z
), f AS (
  SELECT q.*,
    CASE WHEN aj <> 1 THEN NULL
         ELSE least(coalesce(ac, 0), greatest(0, coalesce(ae, 0)), greatest(0, jadval_bugungacha - ab)) END AS af   -- AF
  FROM q
), kum AS MATERIALIZED (SELECT kompaniya_id, lower(shartnoma_no) AS k, sana, kumulyativ FROM ${S}.tolov_jadvali_kum WHERE shartnoma_no IS NOT NULL AND sana IS NOT NULL)
SELECT f.kompaniya_id, f.qator, f.shartnoma_no, f.holati, f.mijoz_id, f.dokon_id, f.shartnoma_sana, f.undiruvchi,
  f.u AS mijoz_fish,
  CASE WHEN f.aj = 1 THEN f.dokon_id END AS dokon_faol_kalit,                                            -- AK =IF(AJ=1,F,"")
  f.v AS real_maydon, f.w AS shartnoma_qiymati, f.x AS qoshimcha_maydon, f.y AS qoshimcha_qiymat, f.z AS umumiy_qiymat,
  f.aa AS oylik_tolov, f.ab AS jami_tolangan, f.ac AS asosiy_qarz, f.ad AS qoshimcha_qarz, f.ae AS jami_qarz,
  f.af AS muddati_otgan_qarz,
  -- AG: =IF(N(AF)<=1000, 0, IF(MINIFS(03b.D, 03b.B, A2, 03b.F, ">"&(AB+1000))=0, 0, BUGUN - MINIFS(…)))
  CASE WHEN coalesce(f.af, 0) <= 1000 THEN 0
       ELSE coalesce((SELECT ${BUGUN} - min(k.sana) FROM kum k
                      WHERE k.kompaniya_id = f.kompaniya_id AND k.k = lower(f.shartnoma_no) AND k.kumulyativ > f.ab + 1000), 0) END AS kechikkan_kun,
  f.aj AS faol_sotuv
FROM f`,
`COMMENT ON VIEW ${S}.sotuv_hisob IS '03_Sotuv_shartnomalar hisoblari U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AJ, AK (Google formulasi bilan bir xil; BUGUN — aks.bugun)'`,

// ---------------------------------------------------------------- 01 do'kon hisoblari (P … AC)
// R: 03 AK (faol shartnomaning do'koni) = A bo'lgan BIRINCHI 03 qatori · S, T, U: R shartnomasining U, N, AE · V: 04 AI (faol ijara) = A ·
// W, X, Y: V ijarasining X (02 C), S, T · Z: xarita holati · AB: faol bo'lsa 03 Z, aks holda P · AC: Σ 05.D (R bo'yicha)
`CREATE VIEW ${S}.dokon_hisob AS
WITH sh AS MATERIALIZED (SELECT * FROM ${S}.sotuv_hisob),
r AS (SELECT DISTINCT ON (kompaniya_id, lower(dokon_faol_kalit)) kompaniya_id, lower(dokon_faol_kalit) AS k, shartnoma_no
      FROM sh WHERE dokon_faol_kalit IS NOT NULL ORDER BY kompaniya_id, lower(dokon_faol_kalit), qator),
sb AS (SELECT DISTINCT ON (kompaniya_id, lower(shartnoma_no)) kompaniya_id, lower(shartnoma_no) AS k, mijoz_fish, holati, jami_qarz, umumiy_qiymat
       FROM sh WHERE shartnoma_no IS NOT NULL ORDER BY kompaniya_id, lower(shartnoma_no), qator),
mi AS (SELECT DISTINCT ON (kompaniya_id, mijoz_id) kompaniya_id, mijoz_id, fish FROM ${S}.mijozlar WHERE mijoz_id IS NOT NULL ORDER BY kompaniya_id, mijoz_id, qator),
ik AS (SELECT DISTINCT ON (kompaniya_id, lower(dokon_id)) kompaniya_id, lower(dokon_id) AS k, ijara_no
       FROM ${S}.ijara_shartnomalar WHERE lower(holati) = 'aktiv' AND dokon_id IS NOT NULL ORDER BY kompaniya_id, lower(dokon_id), qator),
ib AS (SELECT DISTINCT ON (i.kompaniya_id, lower(i.ijara_no)) i.kompaniya_id, lower(i.ijara_no) AS k, i.faoliyat_turi, i.savdo_holati, mi.fish AS ijarachi
       FROM ${S}.ijara_shartnomalar i LEFT JOIN mi ON mi.kompaniya_id = i.kompaniya_id AND mi.mijoz_id = i.mijoz_id
       WHERE i.ijara_no IS NOT NULL ORDER BY i.kompaniya_id, lower(i.ijara_no), i.qator),
zo AS (SELECT DISTINCT ON (kompaniya_id, lower(blok)) kompaniya_id, lower(blok) AS k, usd_m2 FROM ${S}.zona ORDER BY kompaniya_id, lower(blok)),
tl AS (SELECT kompaniya_id, lower(shartnoma_no) AS k, sum(summa)::float8 AS s FROM ${S}.tolovlar WHERE shartnoma_no IS NOT NULL GROUP BY 1, 2),
d AS (
  SELECT d.kompaniya_id, d.qator, d.dokon_id, d.mamuriy_xona,
    coalesce(d.umumiy_qiymat_qolda::float8, d.real_maydon::float8 * d.baza_narx::float8) AS p,     -- P =F*G (qo'lda o'zgartirilgan bo'lsa — o'sha)
    zo.usd_m2::float8 AS q, r.shartnoma_no AS r, sb.k IS NOT NULL AS sb_bor, sb.mijoz_fish, sb.holati, sb.jami_qarz, sb.umumiy_qiymat,
    ik.ijara_no AS v, ib.ijarachi, ib.faoliyat_turi, ib.savdo_holati, coalesce(tl.s, 0) AS tolangan
  FROM ${S}.dokonlar d
  LEFT JOIN zo ON zo.kompaniya_id = d.kompaniya_id AND zo.k = lower(d.blok)
  LEFT JOIN r  ON r.kompaniya_id = d.kompaniya_id AND r.k = lower(d.dokon_id)
  LEFT JOIN sb ON sb.kompaniya_id = d.kompaniya_id AND sb.k = lower(r.shartnoma_no)
  LEFT JOIN ik ON ik.kompaniya_id = d.kompaniya_id AND ik.k = lower(d.dokon_id)
  LEFT JOIN ib ON ib.kompaniya_id = d.kompaniya_id AND ib.k = lower(ik.ijara_no)
  LEFT JOIN tl ON tl.kompaniya_id = d.kompaniya_id AND tl.k = lower(r.shartnoma_no)
), t AS (
  SELECT d.*,
    CASE WHEN r IS NULL THEN 'SOTILMAGAN' ELSE mijoz_fish END AS s,
    CASE WHEN r IS NULL THEN 'Sotilmagan' ELSE holati END AS t
  FROM d
)
SELECT kompaniya_id, qator, dokon_id,
  p AS umumiy_qiymat, q AS ijara_zona, r AS sotuv_shartnoma_no, s AS egasi, t AS sotuv_holati,
  CASE WHEN r IS NULL THEN NULL ELSE jami_qarz END AS jami_qarz,
  v AS ijara_shartnoma_no,
  CASE WHEN v IS NULL THEN NULL ELSE ijarachi END AS ijarachi,
  CASE WHEN v IS NULL THEN NULL ELSE faoliyat_turi END AS faoliyat_turi,
  CASE WHEN v IS NULL THEN 'Бўш' ELSE savdo_holati END AS savdo_holati,
  CASE WHEN mamuriy_xona IS NOT NULL THEN 'Ma''muriyat'
       WHEN lower(coalesce(t, '')) = lower('Shartnoma olmagan') THEN 'Bron'
       WHEN lower(coalesce(s, '')) <> lower('SOTILMAGAN') THEN CASE WHEN v IS NOT NULL THEN 'Sotilgan+ijara' ELSE 'Sotilgan' END
       ELSE CASE WHEN v IS NOT NULL THEN 'Bo''sh+ijara' ELSE 'Bo''sh' END END AS xarita_holati,
  CASE WHEN lower(coalesce(t, '')) IN ('aktiv', 'kredit asosida', 'shartnoma olmagan', 'yakunlangan', 'sudga berish')
       THEN CASE WHEN sb_bor THEN umumiy_qiymat ELSE 0 END ELSE p END AS hisob_qiymati,
  CASE WHEN r IS NULL THEN 0 ELSE tolangan END AS tolangan_rasmiy
FROM t`,
`COMMENT ON VIEW ${S}.dokon_hisob IS '01_Dokonlar hisoblari P, Q, R, S, T, U, V, W, X, Y, Z, AB, AC'`,

// ---------------------------------------------------------------- 04 ijara hisoblari (X, Y, Z, AA, AB, AC, AI)
`CREATE VIEW ${S}.ijara_hisob AS
WITH dh AS MATERIALIZED (SELECT DISTINCT ON (kompaniya_id, lower(dokon_id)) kompaniya_id, lower(dokon_id) AS k, egasi, sotuv_shartnoma_no
                         FROM ${S}.dokon_hisob WHERE dokon_id IS NOT NULL ORDER BY kompaniya_id, lower(dokon_id), qator),
dk AS (SELECT DISTINCT ON (kompaniya_id, lower(dokon_id)) kompaniya_id, lower(dokon_id) AS k, real_maydon
       FROM ${S}.dokonlar WHERE dokon_id IS NOT NULL ORDER BY kompaniya_id, lower(dokon_id), qator),
mi AS (SELECT DISTINCT ON (kompaniya_id, mijoz_id) kompaniya_id, mijoz_id, fish, telefon_1 FROM ${S}.mijozlar WHERE mijoz_id IS NOT NULL ORDER BY kompaniya_id, mijoz_id, qator)
SELECT i.kompaniya_id, i.qator, i.ijara_no,
  mi.fish AS ijarachi_fish, mi.telefon_1 AS ijarachi_telefon,                                       -- X, Y: 02 C, E (F bo'yicha)
  dk.real_maydon::float8 AS real_maydon, dh.egasi, dh.sotuv_shartnoma_no,                           -- Z: 01 F · AA: 01 S · AB: 01 R (E bo'yicha)
  CASE WHEN i.boshlanish_sana IS NULL OR i.bepul_oy IS NULL THEN NULL
       ELSE (i.boshlanish_sana + make_interval(months => trunc(i.bepul_oy)::int))::date END AS bepul_tugash_sana,   -- AC =EDATE(J,M)
  CASE WHEN lower(i.holati) = 'aktiv' THEN i.dokon_id END AS dokon_faol_kalit                       -- AI =IF(C="Aktiv",E,"")
FROM ${S}.ijara_shartnomalar i
LEFT JOIN mi ON mi.kompaniya_id = i.kompaniya_id AND mi.mijoz_id = i.mijoz_id
LEFT JOIN dk ON dk.kompaniya_id = i.kompaniya_id AND dk.k = lower(i.dokon_id)
LEFT JOIN dh ON dh.kompaniya_id = i.kompaniya_id AND dh.k = lower(i.dokon_id)`,
`COMMENT ON VIEW ${S}.ijara_hisob IS '04_Ijara_shartnomalar hisoblari X, Y, Z, AA, AB, AC, AI'`,

// ---------------------------------------------------------------- 05 to'lov qatoridagi shartnoma ma'lumotlari (M … R) — C bo'yicha birinchi 03 qatori
`CREATE VIEW ${S}.tolov_hisob AS
WITH sb AS MATERIALIZED (SELECT DISTINCT ON (kompaniya_id, lower(shartnoma_no)) kompaniya_id, lower(shartnoma_no) AS k,
                           mijoz_id, mijoz_fish, dokon_id, undiruvchi, holati, shartnoma_sana
                         FROM ${S}.sotuv_hisob WHERE shartnoma_no IS NOT NULL ORDER BY kompaniya_id, lower(shartnoma_no), qator)
SELECT t.kompaniya_id, t.qator, t.tolov_id,
  sb.mijoz_id, sb.mijoz_fish, sb.dokon_id,
  CASE WHEN t.shartnoma_no IS NULL THEN NULL ELSE sb.undiruvchi END AS undiruvchi,
  CASE WHEN t.shartnoma_no IS NULL THEN NULL ELSE sb.holati END AS shartnoma_holati,
  CASE WHEN t.shartnoma_no IS NULL THEN NULL ELSE sb.shartnoma_sana END AS shartnoma_sana
FROM ${S}.tolovlar t
LEFT JOIN sb ON sb.kompaniya_id = t.kompaniya_id AND sb.k = lower(t.shartnoma_no)`,
`COMMENT ON VIEW ${S}.tolov_hisob IS '05_Tolovlar hisoblari M, N, O, P, Q, R (03 dan, C bo''yicha)'`,

// ---------------------------------------------------------------- 05b bufer to'lovlar (H, K, L)
`CREATE VIEW ${S}.bufer_hisob AS
WITH sb AS (SELECT DISTINCT ON (kompaniya_id, lower(shartnoma_no)) kompaniya_id, lower(shartnoma_no) AS k, mijoz_fish
            FROM ${S}.sotuv_hisob WHERE shartnoma_no IS NOT NULL ORDER BY kompaniya_id, lower(shartnoma_no), qator),
b AS (SELECT b.*, CASE WHEN b.sana IS NULL THEN NULL ELSE b.sana + 30 END AS h FROM ${S}.bufer_tolovlar b)
SELECT b.kompaniya_id, b.qator, b.bufer_id,
  b.h AS kirim_muddati,                                                                            -- H =IF(B="","",B+30)
  sb.mijoz_fish,                                                                                   -- K: 03 U (C bo'yicha)
  CASE WHEN b.h IS NULL OR lower(coalesce(b.holati, '')) <> lower('Буферда') THEN NULL
       WHEN b.h < ${BUGUN} THEN 'MUDDATI O''TDI' END AS muddat_holati                              -- L
FROM b LEFT JOIN sb ON sb.kompaniya_id = b.kompaniya_id AND sb.k = lower(b.shartnoma_no)`,
`COMMENT ON VIEW ${S}.bufer_hisob IS '05b_Bufer_tolovlar hisoblari H, K, L'`,

// ---------------------------------------------------------------- 01b tashrif jurnali (K, L, M, N, O)
// N =IF(C="","",IF(D<>"",D,LOWER(TRIM(C)))) · O = shu kun (B) va shu kalit (N) bo'yicha BIRINCHI yozuvmi (1/0) ·
// K = shu telefon bilan O=1 bo'lgan yozuvlar soni · L = 02 dan telefon (E, keyin F) bo'yicha Mijoz_ID ·
// M = tashrif kunidan keyin (>= B) shu mijozga sotuv (03 C) yoki ijara (04 B) shartnomasi bormi
`CREATE VIEW ${S}.tashrif_hisob AS
WITH n AS (
  SELECT t.*, CASE WHEN t.fish IS NULL THEN NULL WHEN t.telefon IS NOT NULL THEN t.telefon
                   ELSE lower(regexp_replace(btrim(t.fish, ' '), ' +', ' ', 'g')) END AS kalit
  FROM ${S}.tashriflar t
), o AS (
  SELECT n.*, CASE WHEN n.fish IS NULL THEN NULL
                   WHEN row_number() OVER (PARTITION BY n.kompaniya_id, n.sana, lower(n.kalit) ORDER BY n.qator) = 1 THEN 1 ELSE 0 END AS hisobga
  FROM n
), k AS (
  SELECT o.*, CASE WHEN o.telefon IS NULL THEN NULL
                   ELSE count(*) FILTER (WHERE o.hisobga = 1) OVER (PARTITION BY o.kompaniya_id, lower(o.telefon)) END AS soni
  FROM o
), m1 AS (SELECT DISTINCT ON (kompaniya_id, lower(telefon_1)) kompaniya_id, lower(telefon_1) AS k, mijoz_id FROM ${S}.mijozlar WHERE telefon_1 IS NOT NULL ORDER BY kompaniya_id, lower(telefon_1), qator),
  m2 AS (SELECT DISTINCT ON (kompaniya_id, lower(telefon_2)) kompaniya_id, lower(telefon_2) AS k, mijoz_id FROM ${S}.mijozlar WHERE telefon_2 IS NOT NULL ORDER BY kompaniya_id, lower(telefon_2), qator),
l AS (
  SELECT k.*, CASE WHEN k.telefon IS NULL THEN NULL ELSE coalesce(m1.mijoz_id, m2.mijoz_id) END AS l
  FROM k LEFT JOIN m1 ON m1.kompaniya_id = k.kompaniya_id AND m1.k = lower(k.telefon)
         LEFT JOIN m2 ON m2.kompaniya_id = k.kompaniya_id AND m2.k = lower(k.telefon)
)
SELECT l.kompaniya_id, l.qator, l.tashrif_id,
  l.soni AS tashriflar_soni, l.l AS mijoz_id,
  CASE WHEN l.l IS NULL THEN NULL
       WHEN EXISTS (SELECT 1 FROM ${S}.sotuv_shartnomalar s WHERE s.kompaniya_id = l.kompaniya_id AND s.mijoz_id = l.l AND s.shartnoma_sana >= l.sana)
         OR EXISTS (SELECT 1 FROM ${S}.ijara_shartnomalar i WHERE i.kompaniya_id = l.kompaniya_id AND i.mijoz_id = l.l AND i.sana >= l.sana)
       THEN 'Ha' ELSE 'Mijoz, yangi shartnoma yo''q' END AS shartnoma_tuzdi,
  l.kalit, l.hisobga AS hisobga_olinadi
FROM l`,
`COMMENT ON VIEW ${S}.tashrif_hisob IS '01b_Tashrif_jurnali hisoblari K, L, M, N, O'`,

// ---------------------------------------------------------------- 06b yuridik ishlar (Q, R, S) — B bo'yicha 03 dan
`CREATE VIEW ${S}.yuridik_hisob AS
WITH sb AS (SELECT DISTINCT ON (kompaniya_id, lower(shartnoma_no)) kompaniya_id, lower(shartnoma_no) AS k, mijoz_fish, dokon_id, jami_qarz
            FROM ${S}.sotuv_hisob WHERE shartnoma_no IS NOT NULL ORDER BY kompaniya_id, lower(shartnoma_no), qator)
SELECT y.kompaniya_id, y.qator, y.ish_id,
  CASE WHEN y.shartnoma_no IS NULL THEN NULL ELSE sb.mijoz_fish END AS mijoz_fish,
  CASE WHEN y.shartnoma_no IS NULL THEN NULL ELSE sb.dokon_id END AS dokon_id,
  CASE WHEN y.shartnoma_no IS NULL THEN NULL ELSE sb.jami_qarz END AS jami_qarz
FROM ${S}.yuridik_ishlar y LEFT JOIN sb ON sb.kompaniya_id = y.kompaniya_id AND sb.k = lower(y.shartnoma_no)`,
`COMMENT ON VIEW ${S}.yuridik_hisob IS '06b_Yuridik_ishlar hisoblari Q, R, S'`,
  ];
}

// Solishtirish ro'yxati: [varaq, ko'zgudagi indeks (0 dan), harf, view, view ustuni, aniqlik]
const SOLISHTIR = [
  ['03_Sotuv_shartnomalar', 21, 'V', 'sotuv_hisob', 'real_maydon', 0.0001],
  ['03_Sotuv_shartnomalar', 22, 'W', 'sotuv_hisob', 'shartnoma_qiymati', 0],
  ['03_Sotuv_shartnomalar', 23, 'X', 'sotuv_hisob', 'qoshimcha_maydon', 0.0001],
  ['03_Sotuv_shartnomalar', 24, 'Y', 'sotuv_hisob', 'qoshimcha_qiymat', 0],
  ['03_Sotuv_shartnomalar', 25, 'Z', 'sotuv_hisob', 'umumiy_qiymat', 0],
  ['03_Sotuv_shartnomalar', 26, 'AA', 'sotuv_hisob', 'oylik_tolov', 0],
  ['03_Sotuv_shartnomalar', 27, 'AB', 'sotuv_hisob', 'jami_tolangan', 0],
  ['03_Sotuv_shartnomalar', 28, 'AC', 'sotuv_hisob', 'asosiy_qarz', 0],
  ['03_Sotuv_shartnomalar', 29, 'AD', 'sotuv_hisob', 'qoshimcha_qarz', 0],
  ['03_Sotuv_shartnomalar', 30, 'AE', 'sotuv_hisob', 'jami_qarz', 0],
  ['03_Sotuv_shartnomalar', 31, 'AF', 'sotuv_hisob', 'muddati_otgan_qarz', 0],
  ['03_Sotuv_shartnomalar', 32, 'AG', 'sotuv_hisob', 'kechikkan_kun', 0],
  ['03_Sotuv_shartnomalar', 35, 'AJ', 'sotuv_hisob', 'faol_sotuv', 0],
  ['03b_Tolov_jadvali', 5, 'F', 'tolov_jadvali_kum', 'kumulyativ', 0],
  // 2-qism
  ['03_Sotuv_shartnomalar', 20, 'U', 'sotuv_hisob', 'mijoz_fish', 0],
  ['03_Sotuv_shartnomalar', 36, 'AK', 'sotuv_hisob', 'dokon_faol_kalit', 0],
  ['01_Dokonlar', 15, 'P', 'dokon_hisob', 'umumiy_qiymat', 0.01],
  ['01_Dokonlar', 16, 'Q', 'dokon_hisob', 'ijara_zona', 0],
  ['01_Dokonlar', 17, 'R', 'dokon_hisob', 'sotuv_shartnoma_no', 0],
  ['01_Dokonlar', 18, 'S', 'dokon_hisob', 'egasi', 0],
  ['01_Dokonlar', 19, 'T', 'dokon_hisob', 'sotuv_holati', 0],
  ['01_Dokonlar', 20, 'U', 'dokon_hisob', 'jami_qarz', 0],
  ['01_Dokonlar', 21, 'V', 'dokon_hisob', 'ijara_shartnoma_no', 0],
  ['01_Dokonlar', 22, 'W', 'dokon_hisob', 'ijarachi', 0],
  ['01_Dokonlar', 23, 'X', 'dokon_hisob', 'faoliyat_turi', 0],
  ['01_Dokonlar', 24, 'Y', 'dokon_hisob', 'savdo_holati', 0],
  ['01_Dokonlar', 25, 'Z', 'dokon_hisob', 'xarita_holati', 0],
  ['01_Dokonlar', 27, 'AB', 'dokon_hisob', 'hisob_qiymati', 0.01],
  ['01_Dokonlar', 28, 'AC', 'dokon_hisob', 'tolangan_rasmiy', 0],
  ['04_Ijara_shartnomalar', 23, 'X', 'ijara_hisob', 'ijarachi_fish', 0],
  ['04_Ijara_shartnomalar', 24, 'Y', 'ijara_hisob', 'ijarachi_telefon', 0],
  ['04_Ijara_shartnomalar', 25, 'Z', 'ijara_hisob', 'real_maydon', 0.0001],
  ['04_Ijara_shartnomalar', 26, 'AA', 'ijara_hisob', 'egasi', 0],
  ['04_Ijara_shartnomalar', 27, 'AB', 'ijara_hisob', 'sotuv_shartnoma_no', 0],
  ['04_Ijara_shartnomalar', 28, 'AC', 'ijara_hisob', 'bepul_tugash_sana', 0],
  ['04_Ijara_shartnomalar', 34, 'AI', 'ijara_hisob', 'dokon_faol_kalit', 0],
  ['05_Tolovlar', 12, 'M', 'tolov_hisob', 'mijoz_id', 0],
  ['05_Tolovlar', 13, 'N', 'tolov_hisob', 'mijoz_fish', 0],
  ['05_Tolovlar', 14, 'O', 'tolov_hisob', 'dokon_id', 0],
  ['05_Tolovlar', 15, 'P', 'tolov_hisob', 'undiruvchi', 0],
  ['05_Tolovlar', 16, 'Q', 'tolov_hisob', 'shartnoma_holati', 0],
  ['05_Tolovlar', 17, 'R', 'tolov_hisob', 'shartnoma_sana', 0],
  ['05b_Bufer_tolovlar', 7, 'H', 'bufer_hisob', 'kirim_muddati', 0],
  ['05b_Bufer_tolovlar', 10, 'K', 'bufer_hisob', 'mijoz_fish', 0],
  ['05b_Bufer_tolovlar', 11, 'L', 'bufer_hisob', 'muddat_holati', 0],
  ['01b_Tashrif_jurnali', 10, 'K', 'tashrif_hisob', 'tashriflar_soni', 0],
  ['01b_Tashrif_jurnali', 11, 'L', 'tashrif_hisob', 'mijoz_id', 0],
  ['01b_Tashrif_jurnali', 12, 'M', 'tashrif_hisob', 'shartnoma_tuzdi', 0],
  ['01b_Tashrif_jurnali', 13, 'N', 'tashrif_hisob', 'kalit', 0],
  ['01b_Tashrif_jurnali', 14, 'O', 'tashrif_hisob', 'hisobga_olinadi', 0],
  ['06b_Yuridik_ishlar', 16, 'Q', 'yuridik_hisob', 'mijoz_fish', 0],
  ['06b_Yuridik_ishlar', 17, 'R', 'yuridik_hisob', 'dokon_id', 0],
  ['06b_Yuridik_ishlar', 18, 'S', 'yuridik_hisob', 'jami_qarz', 0],
];
// 06_Undiruv_jurnali M–Q — view EMAS: 601-qatordan beri server yozuv paytidagi qiymatni (snapshot) yozadi, eski qatorlardagi P ni
// lib/portfel.js o'zi qayta hisoblaydi (bo'sh yoki «Вадада» bo'lsa). Shuning uchun ular baza.undiruv_jurnali da saqlanadigan ustun.

module.exports = { sql, SOLISHTIR, BUGUN };
