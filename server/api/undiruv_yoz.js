// AKS TIZIM — undiruvchining YOZUVLARI serverda (Undiruv.gs v26.3 undYoz; Qadam.gs v2.1 qadamChora, qadamNazoratYoz, qadamKechiktir).
// 06_Undiruv_jurnali / 06n_Qadam_kun ga server o'zi yozadi (robot «Редактор»), tekshiruvlar va xato matnlari eski tizim bilan bir xil.
// Rasm / skrinshot — hujjatYukla (serverda). «Rasm ololmadim» holati (qoidabuzarlik + Telegram, ijroDarhol_) — hali eski tizim orqali.
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const X = require('../lib/xat_yordam');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const HY = require('./hujjat_yoz');
const Q = require('./qadam');

const VAR = '06_Undiruv_jurnali', QDV = '06n_Qadam_kun';
const UND_CHORA = ['Телефон', 'Ташриф (манзилига бориб)', 'Офисда суҳбат', 'СМС/Телеграм'];
const UND_NATIJA = ['Боғланилди', 'Боғланиб бўлмади', 'Тўлашдан бош тортди'];
const UND_MUHLAT_KUN = 7, QD_SABAB_MIN = 10;
const t = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
function hozirIso() { const d = new Date(Date.now() + 5 * 3600 * 1000); return d.toISOString().slice(0, 19).replace('T', ' '); }
const harf = n => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };

async function qulfBilan(nom, ish) {
  const kalit = 'qulf:' + nom, belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
// Qatorni to'liq yozish: matnlar bitta so'rovda (USER_ENTERED), sanalar alohida (sana/vaqt sifatida). Y = {ustun: qiymat}, sanalar = {ustun: {iso, naqsh}}
async function qatorYoz(varaq, qator, Y, sanalar) {
  const matn = Object.keys(Y).map(u => ({ varaq, katak: harf(+u) + qator, qiymat: [[Y[u]]] }));
  if (matn.length) await G.yoz(env.aksBazaId, matn, env.googleKey);
  const sn = Object.keys(sanalar || {}).map(u => ({ varaq, qator, ustun: +u, iso: sanalar[u].iso, naqsh: sanalar[u].naqsh }));
  if (sn.length) await G.sanaYoz(env.aksBazaId, sn, env.googleKey);
}
// undBosqichBosh_: joriy zanjirdagi oxirgi yetkazilgan xat sanasi (bo'lmasa — 30 kun oldin)
async function bosqichBosh(no, bugun, kod) {
  const Z = await X.xatZanjir(kod);
  const L = (await J.xatJurnal()).filter(h => h.no === no && h.holati === 'Yuborildi' && (/^QM_/.test(String(h.shablon || '')) || X.xatJoriy(h, Z))).map(h => X.xatIso(h.yetSana || h.sana)).sort();
  return L.length ? L.pop() : U.kunQosh(bugun, -30);
}

// ------------------------------------------------------------------ undYoz
async function undYoz(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  const x = (await U.undShartnomalar()).find(z => z.no === String(d.no || ''));
  if (!x || (!u.admin && x.undiruvchi !== u.fish)) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.');
  if (UND_CHORA.indexOf(d.chora) < 0) throw new S.Xato('Chora turini tanlang.');
  if (UND_NATIJA.indexOf(d.natija) < 0) throw new S.Xato('Natijani tanlang.');
  const mazmun = t(d.mazmun);
  if (mazmun.length < 10) throw new S.Xato('Suhbat mazmunini yozing (kamida 10 belgi): nima dedi, nima kelishildi.');
  const bugun = V.bugun();
  let vs = '', vsum = '';
  if (d.vadaSana || d.vadaSumma) {
    if (d.natija !== 'Боғланилди') throw new S.Xato('Va\'da faqat «Боғланилди» natijasida yoziladi.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.vadaSana || ''))) throw new S.Xato('Va\'da sanasini tanlang.');
    if (d.vadaSana < bugun) throw new S.Xato('Va\'da sanasi o\'tgan kun bo\'lolmaydi.');
    if (d.vadaSana > U.kunQosh(bugun, 90)) throw new S.Xato('Va\'da sanasi 90 kundan uzoq — tekshiring.');
    vsum = Number(String(d.vadaSumma || '').replace(/\D/g, ''));
    if (!(vsum >= 100000)) throw new S.Xato('Va\'da summasini yozing.');
    vs = d.vadaSana;
  }
  let koch = false, eskiVada = [];
  if (vs) {
    const JN = (await J.undJurnal()).filter(j => j.no === x.no && j.vadaSana);
    eskiVada = JN.filter(j => j.vadaNatija === 'Вадада' && j.vadaSana >= bugun);
    if (!u.admin) {
      const bb = await bosqichBosh(x.no, bugun, u.kod);
      const oldin = JN.filter(j => j.sana >= bb && ['', 'Вадада', 'Вадасини бузди', 'Қисман тўлади', 'Кўчирилди'].indexOf(j.vadaNatija) >= 0);
      if (oldin.length >= 2) throw new S.Xato('Bu bosqichda mijozga qayta muddat berish imkoniyati tugagan (xodim 1 marta beradi). Yangi muddat — faqat direktor ruxsati bilan.');
      if (oldin.length === 1) { const p = oldin[0]; const asos = p.vadaSana > bugun ? p.vadaSana : bugun;
        const chek = U.kunQosh(asos, UND_MUHLAT_KUN);
        if (vs > chek) throw new S.Xato('Qayta muddat ko\'pi bilan ' + UND_MUHLAT_KUN + ' kun — ' + chek.split('-').reverse().join('.') + ' gacha. Uzoqroq muddat — faqat direktor ruxsati bilan.');
        koch = true; }
    }
  }
  const tash = d.chora === 'Ташриф (манзилига бориб)';
  const rasmYoq = t(d.rasmYoq);
  const gps = /^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$/.test(String(d.gps || '')) ? String(d.gps) : '';
  const gAn = Math.round(Number(d.gpsAniq) || 0);
  if (tash && !u.admin && !d.rasm && rasmYoq.length < 5)
    throw new S.Xato('Uyiga borganingiz isboti kerak: «📷 Rasmga olish» ni bosing (rasm shu joyning o\'zida olinadi). Kamera ishlamasa — «Rasm ololmadim» va sababini tanlang.');
  // rasm yo'q (qoidabuzarlik + Telegram) — eski tizim yo'li bilan
  if (tash && !d.rasm && rasmYoq && !u.admin) return eskiTizim('undYoz', u, [d]);
  const hh = hozirIso().slice(11, 16), bel = String(Date.now()).slice(-4);
  let tashIz = '';
  if (tash && d.rasm) {
    const r = await HY.hujjatYukla([kodSes, { no: x.no, turi: 'BOSHQA', sana: bugun, b64: d.rasm, sahifa: 1,
      izoh: 'ТАШРИФ № ' + hh + '.' + bel + ' · ' + (gps ? '📍 ' + gps + (gAn ? ' ±' + gAn + ' м' : '') : 'жойлашув олинмади') + ' · ' + mazmun.slice(0, 100) }]);
    d.tashFayl = r.nom;
    tashIz = gps ? '📍 ' + gps + (gAn ? ' ±' + gAn + ' m' : '') : '📍 joylashuv olinmadi' + (d.gpsX ? ': ' + String(d.gpsX).slice(0, 80) : '');
  } else if (tash && rasmYoq) tashIz = '📷 rasm yo\'q: ' + rasmYoq.slice(0, 120);
  let fayl = d.tashFayl || '';
  if (d.b64) {
    const r = await HY.hujjatYukla([kodSes, { no: x.no, turi: 'YOZISHMA', sana: bugun, b64: d.b64, sahifa: d.sahifa || '', izoh: 'СМС № ' + hh + '.' + bel + ' · ' + d.chora + ' · ' + mazmun.slice(0, 120) }]);
    fayl = r.nom;
  }
  return qulfBilan('und', async () => {
    const ids = await G.ustunOqi(env.aksBazaId, VAR, 'A', env.googleKey);
    let max = 0; ids.forEach(v => { const n = Number(v); if (n > max) max = n; });
    const id = max + 1, row = ids.length + 1;
    const iz = [String(d.izoh || '').trim(), tashIz, koch ? '📅 Qayta muddat (oldingi va\'da ko\'chirildi)' : ''].filter(Boolean).join(' · ');
    const vaqt = hozirIso();
    await G.qatorQosh(env.aksBazaId, VAR, [id, bugun.split('-').reverse().join('.'), x.no, x.undiruvchi || u.fish, d.chora, mazmun, vs ? vs.split('-').reverse().join('.') : '', vsum || '', fayl, u.fish,
      vaqt, iz, x.fish, x.dokon, x.jami, vs ? 'Вадада' : '', x.mid, d.natija], env.googleKey);
    const sn = { 2: { iso: bugun }, 11: { iso: vaqt, naqsh: 'dd.MM.yyyy HH:mm:ss' } }; if (vs) sn[7] = { iso: vs };
    await G.sanaYoz(env.aksBazaId, Object.keys(sn).map(k => ({ varaq: VAR, qator: row, ustun: +k, iso: sn[k].iso, naqsh: sn[k].naqsh })), env.googleKey);
    if (eskiVada.length) await G.yoz(env.aksBazaId, eskiVada.map(j => ({ varaq: VAR, katak: 'P' + j.qator, qiymat: [['Кўчирилди']] })), env.googleKey);
    await Promise.race([tetik.varaqlarYangila(fayl ? [VAR, '06d_Hujjatlar'] : [VAR]).catch(e => console.error('ko\'zgu (undYoz):', e.message)), new Promise(r => setTimeout(r, 15000))]);
    return { ok: true, id, no: x.no };
  });
}

async function qadamChora(args) {
  const r = await undYoz(args);
  const m = await Q.qadamMijoz([args[0], r.no]); m.saqlandi = r; return m;
}
async function qadamNazoratYoz(args) {
  const r = await undYoz(args);
  const N = await Q.qadamNazorat([args[0]]); N.saqlandi = r; return N;
}
// 🟡/🟢 qadamni bugun bajarmaslik — sabab bilan (06n ga «Kechiktirildi»)
async function qadamKechiktir(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  const sabab = t(d.sabab); if (sabab.length < QD_SABAB_MIN) throw new S.Xato('Sababini yozing (kamida ' + QD_SABAB_MIN + ' belgi): nega bugun qila olmaysiz.');
  const bugun = V.bugun();
  const m = (await Q.qadamMijoz([kodSes, String(d.no || '')])).mijoz;
  if (!m) throw new S.Xato('Bu mijoz portfelingizda emas.');
  if (m.yopildi) throw new S.Xato('Bu mijoz bugun allaqachon o\'tkazilgan.');
  const q = m.qadam.find(z => z.k === String(d.k || ''));
  if (!q || q.holat !== 'kutadi') throw new S.Xato('Bu qadam hozir kutilayotganlar ro\'yxatida yo\'q — sahifani yangilang.');
  if (q.d === 'q') throw new S.Xato('🔴 qadamni ertaga qoldirib bo\'lmaydi — bajaring yoki «Bugun qila olmayman» ni bosing.');
  const qoladi = m.qadam.filter(z => z.holat === 'kutadi' && z.k !== q.k).length;
  if (!m.faol && !qoladi) throw new S.Xato('Bu mijoz bo\'yicha bugun hali hech narsa qilinmadi. Oxirgi qadamni ham qoldirsangiz, mijoz o\'tkazilgan bo\'ladi — pastdagi «⏭ Bugun qila olmayman» ni bosing.');
  const bugunMatn = m.bugun.map(b => (b.vaqt ? b.vaqt + ' ' : '') + b.matn).join(' | ').slice(0, 1000);
  await qulfBilan('qadam', async () => {
    const ids = await G.ustunOqi(env.aksBazaId, QDV, 'A', env.googleKey); const row = ids.length + 1; const vaqt = hozirIso();
    await G.qatorQosh(env.aksBazaId, QDV, [bugun.split('-').reverse().join('.'), u.fish, m.no, m.fish, 'Kechiktirildi', sabab.slice(0, 300), q.t, bugunMatn, vaqt], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: QDV, qator: row, ustun: 1, iso: bugun }, { varaq: QDV, qator: row, ustun: 9, iso: vaqt, naqsh: 'dd.MM.yyyy HH:mm:ss' }], env.googleKey);
    await Promise.race([tetik.varaqlarYangila([QDV]).catch(() => {}), new Promise(r => setTimeout(r, 15000))]);
  });
  return Q.qadamMijoz([kodSes, d.no]);
}

module.exports = { undYoz, qadamChora, qadamNazoratYoz, qadamKechiktir };
