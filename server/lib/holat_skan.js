// AKS TIZIM — «Shartnoma olmagan» → «Aktiv»: imzolangan shartnoma skani yuklangan bo'lsa holat o'zi yangilanadi (06.11.2026, direktor qarori).
// Sabab: «Shartnoma olmagan» holati migratsiyada qo'lda qo'yilgan; skan yuklash (06d) 03 holatiga hech qachon tegmagan — shartnoma imzolangan
// bo'lsa ham bazada «olmagan» bo'lib qolar, xaritada do'kon «Bron» ko'rinardi (27/311, 27/312, 27/313 — 16.10 va 02.10 da skan yuklangan).
// Qoida: 03 N = «Shartnoma olmagan» va 06d da shu shartnomaning «SHARTNOMA» turidagi «Faol» skani bor → 03 N = «Aktiv», 03 T izohiga yozuv,
// 06j_Tahrir_jurnali ga qator, direktorga Telegram. Shartnoma sanasi (03 C) O'ZGARMAYDI.
// Qachon: skan yuklangan zahoti (api/hujjat_yoz.js) va har kuni 06:40 (lib/vaqt.js «holat_skan») — o'tkazib yuborilgan holatlar ham tuzaladi.
'use strict';
const V = require('./varaq');
const G = require('./google');
const env = require('./env');
const J = require('./jurnallar');
const tetik = require('./kozgu_tetik');
const { redis } = require('./db');

const S3 = '03_Sotuv_shartnomalar', JUR = '06j_Tahrir_jurnali';
const ESKI = 'Shartnoma olmagan', YANGI = 'Aktiv';
// direktor ko'rsatmasi bilan alohida izoh (06.11.2026): qog'ozdagi sana va 9.7-band — bazadagi sana 11.09.2025 qoladi
const MAXSUS_IZOH = {
  '27/311': "Qog'ozda imzolangan sana: 09.09.2026; shartlar 11.09.2025 dan amal qiladi (9.7-band, FK 357-modda)",
  '27/312': "Qog'ozda imzolangan sana: 09.09.2026; shartlar 11.09.2025 dan amal qiladi (9.7-band, FK 357-modda)",
  '27/313': "Qog'ozda imzolangan sana: 09.09.2026; shartlar 11.09.2025 dan amal qiladi (9.7-band, FK 357-modda)"
};
const s = v => String(v == null ? '' : v);
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { dmy: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(), dmyHm: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) }; }

// Tuzatiladiganlar: [{ qator, no, mid, fish, dokon, izoh, hj }]
async function topish() {
  const skan = {};
  (await J.hujjatJurnal()).forEach(h => { if (h.turi === 'SHARTNOMA' && h.holati === 'Faol' && h.no && !skan[h.no]) skan[h.no] = h; });
  const L = [];
  (await V.qatorlar(S3)).forEach(({ n, r }) => {
    const no = s(r[0]).trim();
    if (!no || s(r[13]).trim() !== ESKI || !skan[no]) return;
    L.push({ qator: n, no, mid: s(r[4]), dokon: s(r[5]), fish: s(r[20]), izoh: s(r[19]), hj: skan[no] });
  });
  return L;
}

// tuzat({ quruq, no, kim }) — quruq: faqat ro'yxat; no: faqat shu shartnoma (skan yuklangan zahoti)
async function tuzat(o = {}) {
  if (!(await redis.set('holat_skan_qulf', '1', 'NX', 'EX', 300))) return { band: true, L: [] };
  try {
    let L = await topish();
    if (o.no) L = L.filter(x => x.no === o.no);
    if (o.quruq || !L.length) return { L };
    const h = hozir(), D = [], log = [];
    for (const x of L) {
      // Google'dagi haqiqiy qatorni qayta tekshirish (ko'zgu eskirgan bo'lishi mumkin)
      const q = await G.qatorOqi(env.aksBazaId, S3, x.qator, 'T', env.googleKey);
      if (s(q[0]).trim() !== x.no || s(q[13]).trim() !== ESKI) continue;
      const qosh = (MAXSUS_IZOH[x.no] ? MAXSUS_IZOH[x.no] + '. ' : '') + h.dmy + ': holat «' + ESKI + '» → «' + YANGI + '» (imzolangan skan HJ ' + x.hj.id + ', ' + s(x.hj.vaqt).slice(0, 10) + ')';
      const izoh = s(q[19]).trim();
      D.push({ varaq: S3, katak: 'N' + x.qator, qiymat: [[YANGI]] }, { varaq: S3, katak: 'T' + x.qator, qiymat: [[(izoh ? izoh + ' | ' : '') + qosh]] });
      log.push([h.dmyHm, x.no, 'sotuv', x.mid, 'Holati', ESKI, YANGI, o.kim || 'Tizim', 'avto — imzolangan skan yuklangan (HJ ' + x.hj.id + ')']);
      x.qosh = qosh;
    }
    if (!D.length) return { L: [] };
    await G.yoz(env.aksBazaId, D, env.googleKey);
    try {   // 06j — A ustunining oxiridan keyin, ID ketma-ket
      const A = await G.ustunOqi(env.aksBazaId, JUR, 'A', env.googleKey);
      let id = Math.max(0, ...A.slice(1).map(v => Number(v) || 0));
      await G.qatorlarQoshR(env.aksBazaId, JUR, A.length + 1, log.map(z => [++id].concat(z)), env.googleKey);
    } catch (e) { console.error('holat_skan 06j:', e.message); }
    await Promise.race([tetik.varaqlarYangila([S3, JUR]).catch(() => {}), new Promise(r => setTimeout(r, 15000))]);
    const yangi = L.filter(x => x.qosh);
    try {
      const TG = require('./telegram');
      if (TG.bor()) await TG.direktor('✅ <b>Shartnoma holati yangilandi</b> — imzolangan skan yuklangan:\n'
        + yangi.map(x => '• <b>' + x.no + '</b> ' + x.fish + ' (' + x.dokon + '): «' + ESKI + '» → «' + YANGI + '»').join('\n'));
    } catch (e) { console.error('holat_skan TG:', e.message); }
    console.log(new Date().toISOString(), 'holat_skan:', yangi.map(x => x.no).join(', '));
    return { L: yangi };
  } finally { await redis.del('holat_skan_qulf').catch(() => {}); }
}

module.exports = { tuzat, topish, ESKI, YANGI, MAXSUS_IZOH };
