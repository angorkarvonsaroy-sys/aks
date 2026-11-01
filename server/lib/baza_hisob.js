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
WITH s AS (
  SELECT s.kompaniya_id, s.qator, s.shartnoma_no, s.holati,
    s.shartnoma_maydon::float8 AS g, s.shartnoma_1m2_narx::float8 AS h, s.boshlangich_summa::float8 AS j, s.muddatli_oy::float8 AS l,
    -- V: =IFERROR(INDEX('01_Dokonlar'!F, MATCH(F2, '01_Dokonlar'!A, 0)), "")
    (SELECT d.real_maydon::float8 FROM ${S}.dokonlar d
      WHERE d.kompaniya_id = s.kompaniya_id AND s.dokon_id IS NOT NULL AND lower(d.dokon_id) = lower(s.dokon_id)
      ORDER BY d.qator LIMIT 1) AS v,
    -- AB: =SUMIFS(05.D, 05.C, A2) + SUMIFS(05b.D, 05b.C, A2, 05b.G, "Буферда")
    coalesce((SELECT sum(t.summa)::float8 FROM ${S}.tolovlar t WHERE t.kompaniya_id = s.kompaniya_id AND lower(t.shartnoma_no) = lower(s.shartnoma_no)), 0)
    + coalesce((SELECT sum(b.summa)::float8 FROM ${S}.bufer_tolovlar b WHERE b.kompaniya_id = s.kompaniya_id AND lower(b.shartnoma_no) = lower(s.shartnoma_no)
                AND lower(b.holati) = lower('Буферда')), 0) AS ab,
    -- AF uchun: =SUMIFS(03b.E, 03b.B, A2, 03b.D, "<="&BUGUN)
    coalesce((SELECT sum(k.summa)::float8 FROM ${S}.tolov_jadvali k WHERE k.kompaniya_id = s.kompaniya_id AND lower(k.shartnoma_no) = lower(s.shartnoma_no)
                AND k.sana <= ${BUGUN}), 0) AS jadval_bugungacha,
    CASE WHEN lower(s.holati) IN ${FAOL} THEN 1 ELSE 0 END AS aj
  FROM ${S}.sotuv_shartnomalar s
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
)
SELECT f.kompaniya_id, f.qator, f.shartnoma_no, f.holati,
  f.v AS real_maydon, f.w AS shartnoma_qiymati, f.x AS qoshimcha_maydon, f.y AS qoshimcha_qiymat, f.z AS umumiy_qiymat,
  f.aa AS oylik_tolov, f.ab AS jami_tolangan, f.ac AS asosiy_qarz, f.ad AS qoshimcha_qarz, f.ae AS jami_qarz,
  f.af AS muddati_otgan_qarz,
  -- AG: =IF(N(AF)<=1000, 0, IF(MINIFS(03b.D, 03b.B, A2, 03b.F, ">"&(AB+1000))=0, 0, BUGUN - MINIFS(…)))
  CASE WHEN coalesce(f.af, 0) <= 1000 THEN 0
       ELSE coalesce((SELECT ${BUGUN} - min(k.sana) FROM ${S}.tolov_jadvali_kum k
                      WHERE k.kompaniya_id = f.kompaniya_id AND lower(k.shartnoma_no) = lower(f.shartnoma_no)
                        AND k.kumulyativ > f.ab + 1000 AND k.sana IS NOT NULL), 0) END AS kechikkan_kun,
  f.aj AS faol_sotuv
FROM f`,
`COMMENT ON VIEW ${S}.sotuv_hisob IS '03_Sotuv_shartnomalar hisoblari V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AJ (Google formulasi bilan bir xil; BUGUN — aks.bugun)'`,
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
];

module.exports = { sql, SOLISHTIR, BUGUN };
