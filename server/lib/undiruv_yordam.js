// AKS TIZIM — Undiruv.gs dagi umumiy yordamchilarning serverdagi o'rni (ko'zgudan o'qiydi, hech narsa yozmaydi).
//   undShartnomalar (undShartnomalar_ v26.3) · undTolovlar (undTolovlar_) · oxirgiTolov (undOxirgiTolov_) · jadvalOxiri (undJadvalOxiri_)
//   sekin (undSekin_) · davoKun (undDavoKun_) · mijozManzil (mijozManzil_)
// Natija shakli eski tizim bilan BIR XIL — Yurist, Monitoring, Bosh sahifa shunga tayanadi.
'use strict';
const V = require('./varaq');

const UND_SEKIN_OY = 6;

const kun = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
const kunQosh = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

function mijozManzil(r) {
  const t = v => String(v == null ? '' : v).trim();
  const n = t(r[13]), o = t(r[14]), p = t(r[15]), q = t(r[16]), uy = t(r[17]), x = t(r[18]);
  let s = n ? (/(вилояти|шаҳри|Республикаси)/.test(n) ? n : n + ' вилояти') : '';
  if (o) s += ' ' + o;
  if (p) s += ' ' + p + ' МФЙ';
  if (q) s += ' ' + q + ' кўчаси';
  if (uy) s += ' ' + uy + '-уй';
  if (x) s += ', ' + x + '-хонадон';
  return s.trim() || t(r[25]);
}

// 05_Tolovlar — [{sana, no, summa, shakl}] (xom)
async function undTolovlar() {
  return (await V.qatorlar('05_Tolovlar')).map(({ x }) => ({ sana: V.iso(x[1]), no: String(x[2] == null ? '' : x[2]), summa: V.son(x[3]), shakl: String(x[4] == null ? '' : x[4]) }))
    .filter(t => t.sana && t.no !== '');
}

// shartnoma → {sana, summa, soni, s12, s90}
async function oxirgiTolov(bugun) {
  const y12 = kunQosh(bugun, -365), y90 = kunQosh(bugun, -90);
  const m = {};
  (await undTolovlar()).forEach(t => { if (!(t.summa > 0)) return; const o = m[t.no] || (m[t.no] = { sana: '', summa: 0, soni: 0, s12: 0, s90: 0 });
    o.soni++; if (t.sana >= o.sana) { o.sana = t.sana; o.summa = t.summa; } if (t.sana > y12) o.s12 += t.summa; if (t.sana > y90) o.s90 += t.summa; });
  return m;
}

// shartnoma → to'lov jadvalining oxirgi sanasi (03b)
async function jadvalOxiri() {
  const m = {};
  (await V.qatorlar('03b_Tolov_jadvali')).forEach(({ x }) => { const no = String(x[1] == null ? '' : x[1]).trim(); const s = V.iso(x[3]); if (!no || !s) return; if (!m[no] || s > m[no]) m[no] = s; });
  return m;
}

function sekin(jami, muddati, jo, ox, bugun) {
  if (!(Number(muddati) > 100000) || !jo || jo >= bugun || !ox || !(ox.s12 > 0)) return null;
  const oy = Math.round(Number(jami) / ox.s12 * 12); return oy > UND_SEKIN_OY ? { oy, s12: Math.round(ox.s12), jadval: jo } : null;
}
function davoKun(kechikkan, muddati, ox, bugun) {
  const k = Number(kechikkan) || 0; if (!(Number(muddati) > 0) || !ox || !ox.sana) return k;
  return Math.max(0, Math.min(k, kun(ox.sana, bugun)));
}

// Undiruvdagi barcha sotuv shartnomalari (bekor qilinmaganlar; qarzi bor yoki undiruvchisi bor)
async function undShartnomalar() {
  const bugun = V.bugun();
  const [OX, JO] = await Promise.all([oxirgiTolov(bugun), jadvalOxiri()]);
  const MJ = {};
  (await V.qatorlar('02_Mijozlar')).forEach(({ x }) => { if (x[0] == null || x[0] === '') return;
    MJ[String(x[0])] = { tel: [x[4], x[5]].filter(Boolean).map(String).join(', '), manzil: mijozManzil(x.map(v => v == null ? '' : v)),
      ota: String(x[2] == null ? '' : x[2]).trim().split(/\s+/).length >= 3, jshshir: /^\d{14}$/.test(String(x[11] == null ? '' : x[11]).trim()) }; });
  const L = [];
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x }) => {
    const s = i => String(x[i] == null ? '' : x[i]);
    const no = s(0).trim(); if (!/^27\/\d+$/.test(no) || /bekor/i.test(s(13))) return;
    const m = MJ[s(4)] || {};
    L.push({ no, sana: V.iso(x[2]), mid: s(4), dokon: s(5), holati: s(13), undiruvchi: s(17).trim(),
      fish: s(20), oylik: V.son(x[26]), asosiy: V.son(x[28]), qoshimcha: V.son(x[29]), jami: V.son(x[30]),
      muddati: V.son(x[31]), kechikkan: V.son(x[32]), tel: m.tel || '', manzil: m.manzil || '',
      ota: m.ota !== false, jshshir: !!m.jshshir, boshKun: V.son(x[10]), tolangan: V.son(x[27]),
      oxirgiTolov: OX[no] || null, davoKun: davoKun(V.son(x[32]), V.son(x[31]), OX[no], bugun), sekin: sekin(V.son(x[30]), V.son(x[31]), JO[no], OX[no], bugun) });
  });
  return L.filter(x => x.jami > 0 || x.undiruvchi);
}

module.exports = { undShartnomalar, undTolovlar, oxirgiTolov, jadvalOxiri, sekin, davoKun, mijozManzil, kun, kunQosh };
