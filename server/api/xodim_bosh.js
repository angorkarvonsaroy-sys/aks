// AKS TIZIM — 🏠 Xodim bosh sahifasi: xodimBosh (XodimBosh.gs v1.1) serverda. Faqat o'qiydi; natija eski tizim bilan bir xil.
// Har blok alohida himoyalangan: bittasi xato bersa, qolgani chiqaveradi (xato ro'yxatda).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const U = require('../lib/undiruv_yordam');
const { xodimTeng } = require('../lib/xodim');

const XB_SKAN_KUN = 3, XB_XAT_KUN = 3, XB_PASPORT_KUN = 30, XB_BEPUL_KUN = 14, XB_IJRO_KUN = 2;
const XB_OXIRGI = 6, XB_QILDIM = 14, XB_DIQQAT = 6, XB_KEYINGI = 5;
const XB_KUNLAR = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const XB_OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const HUJJAT_NAZORAT_BOSHI = '2026-09-29', HUJJAT_NAZORAT_KUN = 3;

const num = x => { const n = Number(x); return isNaN(n) ? 0 : Math.round(n); };
const monQisqa = f => String(f || '').trim().split(/\s+/).slice(0, 2).join(' ');
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const xom = (x, n) => { const o = []; for (let i = 0; i < n; i++) o.push(x[i] == null ? '' : x[i]); return o; };
const sanami = v => typeof v === 'number' && v > 20000 && v < 80000;   // getValues → Date
function hm(v) { const ms = Math.round((v - Math.floor(v + 1e-7)) * 86400000); const sek = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(sek / 3600)).padStart(2, '0') + ':' + String(Math.floor(sek % 3600 / 60)).padStart(2, '0'); }
function xbIso(v) {
  if (sanami(v)) return V.iso(v);
  const s = String(v || '').trim(); let m;
  if ((m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s))) return m[3] + '-' + m[2] + '-' + m[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}
function xbVaqt(v) {
  if (sanami(v)) { const iso = V.iso(v), h = hm(v); return { iso, hm: h, srt: iso + ' ' + h }; }
  const s = String(v || '').trim(); let m;
  if ((m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(s))) { const iso = m[3] + '-' + m[2] + '-' + m[1], h = m[4] ? m[4] + ':' + m[5] : '00:00'; return { iso, hm: h, srt: iso + ' ' + h }; }
  if ((m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s))) { const h = m[2] ? m[2] + ':' + m[3] : '00:00'; return { iso: m[1], hm: h, srt: m[1] + ' ' + h }; }
  return { iso: '', hm: '', srt: '' };
}
const xbQachon = (vq, bugun, kecha) => vq.iso === bugun ? 'bugun ' + vq.hm : vq.iso === kecha ? 'kecha' : vq.iso.split('-').reverse().join('.');
const xbIsm = fish => { const p = String(fish || '').trim().split(/\s+/); return p.length >= 2 ? p[1] : (p[0] || ''); };
// String(Date) o'rniga (getValues sana bo'lsa) — kamdan-kam holat; raqam/matn o'zicha
const st = v => String(v);

async function devonRows() {
  const s = v => String(v == null ? '' : v);
  return (await V.qatorlar('11_Devonxona')).map(({ r }) => ({ id: r[0] || '', turi: r[1] || '', tartib: r[2] || '', kiritildi: r[3] || '', kim: r[4] || '', tashkilot: r[5] || '', raqam: r[6] || '',
    holati: r[10] || '', ijrochi: r[12] || '', yordam: s(r[13]).split(',').map(z => z.trim()).filter(Boolean), muddat: r[14] || '' })).filter(x => x.id);
}

async function xodimBosh([kodSes]) {
  const u = await S.ruxsat(kodSes);
  const H = u.huquq || [], adm = H.indexOf('admin') >= 0, bor = h => adm || H.indexOf(h) >= 0;
  const bugun = V.bugun();
  const kun = n => U.kunQosh(bugun, n);
  const kecha = kun(-1), oyBosh = bugun.slice(0, 8) + '01';
  const kunFarq = iso => iso ? U.kun(iso, bugun) : 0;
  const men = v => xodimTeng(v, u.fish);
  const qisq = monQisqa;
  const dmy = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('.') : '';
  const xato = [];
  const blok = async (nom, f, bosh) => { try { return await f(); } catch (e) { xato.push(nom + ': ' + e.message); return bosh; } };
  const oqi = async (nom, ust) => aOxiri(await V.qatorlar(nom)).map(z => xom(z.x, ust));

  const OX = [], QL = [], jami = { tolov: 0, tashrif: 0, shartnoma: 0, xat: 0, hujjat: 0, topshiriq: 0, devon: 0, chora: 0, taminot: 0 };
  const yoz = (vq, ik, nom, iz, och, kalit, matn, tur) => {
    if (!vq.srt) return;
    OX.push({ srt: vq.srt, ik, nom, iz: iz + ' · ' + xbQachon(vq, bugun, kecha), och, kalit });
    if (vq.iso === bugun) { QL.push({ srt: vq.srt, vaqt: vq.hm, matn, t: tur }); jami[tur] = (jami[tur] || 0) + 1; }
  };

  // ---------- 1. topshiriqlar (topMening)
  const top = await blok('topshiriq', async () => {
    const r = await require('./topshiriq').topMening([kodSes]); const b = dmy(bugun);
    const TS = require('../lib/tasdiq');
    const O = r.ochiq || [];
    const bugungi = O.filter(x => x.kechikkan || String(x.muddat || '').slice(0, 10) === b || x.holati === 'Tekshiruvda');
    const keyingi = O.filter(x => bugungi.indexOf(x) < 0).map(x => ({ x, iso: TS.topIso(x.muddat).slice(0, 10) })).filter(z => z.iso && z.iso > bugun && z.iso <= kun(7))
      .sort((a, b2) => a.iso < b2.iso ? -1 : 1).map(z => z.x);
    const kor = x => ({ id: x.id, sarlavha: x.sarlavha, izoh: x.izoh, no: x.no, mid: x.mid, muddat: x.muddat, kechikkan: !!x.kechikkan, holati: x.holati, kalit: x.kalit, qoida: x.qoida, manba: x.manba, kimBerdi: x.kimBerdi, muhim: x.muhim, dalil: x.dalil,
      bugun: String(x.muddat || '').slice(0, 10) === b });
    const tartib = x => x.kechikkan ? 0 : x.holati === 'Tekshiruvda' ? 2 : 1;
    bugungi.sort((a, b2) => tartib(a) - tartib(b2) || (TS.topIso(a.muddat) < TS.topIso(b2.muddat) ? -1 : 1));
    (r.yopiq || []).forEach(x => { const vq = xbVaqt(x.yopildi); if (vq.iso === bugun) { QL.push({ srt: vq.srt, vaqt: vq.hm, matn: 'Topshiriq bajarildi — ' + x.sarlavha + (x.no ? ' · ' + x.no : ''), t: 'topshiriq' }); jami.topshiriq++; } });
    return { kechikkan: r.son.kechikkan, bugun: r.son.bugun, ochiq: r.son.ochiq, tekshiruv: O.filter(x => x.holati === 'Tekshiruvda').length, hafta: r.son.hafta,
      royxat: bugungi.map(kor), keyingi: keyingi.slice(0, XB_KEYINGI).map(kor), keyingiSoni: keyingi.length, boshqa: O.length - bugungi.length - keyingi.length };
  }, null);

  const diqqat = [], rol = [];
  const dq = (rang, matn, och, tartib) => diqqat.push({ rang, matn, och, t: tartib });

  // ---------- 2. to'lovlar (05)
  const tolov = await blok('tolov', async () => {
    const c = { bugun: 0, kecha: 0 }; if (!bor('tolov')) return c;
    (await oqi('05_Tolovlar', 15)).forEach(r => { if (!r[0] || !men(r[9])) return; const vq = xbVaqt(r[10]); const sana = xbIso(r[1]);
      if (sana === bugun) c.bugun++; else if (sana === kecha) c.kecha++;
      yoz(vq, '💵', qisq(r[13]) || st(r[2]), st(r[2]) + (r[14] ? ' · ' + r[14] : '') + " · to'lov", { t: 'shartnoma', v: st(r[2]), mid: String(r[12] || '') }, r[12] ? 'mijoz:' + r[12] : 'sh:' + r[2],
        "To'lov kiritildi — " + r[2] + (r[4] ? ', ' + String(r[4]).toLowerCase() : ''), 'tolov'); });
    return c; }, { bugun: 0, kecha: 0 });

  // ---------- 3. tashriflar (01b)
  const tash = await blok('tashrif', async () => {
    const c = { bugun: 0, kecha: 0 }; if (!bor('tashrif')) return c;
    (await oqi('01b_Tashrif_jurnali', 17)).forEach(r => { if (!r[0] || !men(r[8])) return; const sana = xbIso(r[1]); if (sana === bugun) c.bugun++; else if (sana === kecha) c.kecha++;
      const vq = xbVaqt(r[9]); const mid = String(r[11] || ''); const tel = String(r[16] == null ? '' : r[16]).trim() === 'Telefon';   // 📞 01b Q
      yoz(vq, tel ? '📞' : '🚶', qisq(r[2]), (tel ? 'telefon murojaati' : 'tashrif') + (r[6] ? ' · ' + String(r[6]).toLowerCase() : ''), mid ? { t: 'mijoz', v: mid } : { t: 'qidir', v: st(r[2]) }, mid ? 'mijoz:' + mid : 'tash:' + r[2],
        (tel ? 'Telefon murojaati yozildi — ' : 'Tashrif yozildi — ') + qisq(r[2]) + (r[6] ? ' (' + String(r[6]).toLowerCase() + ')' : ''), 'tashrif'); });
    return c; }, { bugun: 0, kecha: 0 });

  // ---------- 4. shartnomalar (03, 04) — skani yo'q, bu oy, bepul davri; pasport
  const sh = await blok('shartnoma', async () => {
    const c = { bugun: 0, kecha: 0, oy: 0, skansiz: [], bepul: [], mid: {} }; const kerak = bor('shartnoma') || bor('hujjat'); if (!kerak) return c;
    const skanBor = {}; (await oqi('06d_Hujjatlar', 14)).forEach(r => { if (r[0] && st(r[5]) === 'SHARTNOMA' && st(r[13]) === 'Faol') skanBor[st(r[1]).trim()] = 1; });
    const skansizMi = (no, sana, bek) => !bek && sana >= HUJJAT_NAZORAT_BOSHI && kunFarq(sana) >= HUJJAT_NAZORAT_KUN && !skanBor[no];
    const kim3 = {}; (await oqi('03b_Tolov_jadvali', 8)).forEach(r => { const m = /^Web App: (.+)$/.exec(String(r[7] || '')); if (m && r[1] && !kim3[st(r[1])]) kim3[st(r[1])] = m[1]; });
    (await oqi('03_Sotuv_shartnomalar', 42)).forEach(r => { if (!r[0]) return; const no = st(r[0]); if (!men(r[41] || kim3[no])) return; const sana = xbIso(r[2]), bek = /bekor/i.test(String(r[13] || ''));
      if (/QAYTA TUZ(ISH|ILDI)/i.test(String(r[19] || ''))) return;
      if (!bek) { if (sana === bugun) c.bugun++; else if (sana === kecha) c.kecha++; if (sana >= oyBosh) c.oy++; c.mid[st(r[4])] = { no, fish: qisq(r[20]) }; }
      if (skansizMi(no, sana, bek)) c.skansiz.push({ no, kun: kunFarq(sana), fish: qisq(r[20]), dokon: String(r[5] || '') });
      const vq = xbVaqt(r[40]); yoz(vq, '📄', no + ' · ' + qisq(r[20]), 'sotuv · ' + (r[5] || ''), { t: 'shartnoma', v: no, mid: String(r[4] || '') }, r[4] ? 'mijoz:' + r[4] : 'sh:' + no, 'Shartnoma ' + no + ' tuzildi — sotuv, ' + (r[5] || ''), 'shartnoma'); });
    (await oqi('04_Ijara_shartnomalar', 38)).forEach(r => { if (!r[0] || !men(r[20])) return; const no = st(r[0]), sana = xbIso(r[1]), bek = /bekor/i.test(String(r[2] || ''));
      if (!bek) { if (sana === bugun) c.bugun++; else if (sana === kecha) c.kecha++; if (sana >= oyBosh) c.oy++; c.mid[st(r[5])] = { no, fish: qisq(r[23]) };
        const bt = xbIso(r[28]); if (bt && bt >= bugun && bt <= kun(XB_BEPUL_KUN)) c.bepul.push({ no, qolgan: -kunFarq(bt), fish: qisq(r[23]), dokon: String(r[4] || '') }); }
      if (skansizMi(no, sana, bek)) c.skansiz.push({ no, kun: kunFarq(sana), fish: qisq(r[23]), dokon: String(r[4] || '') });
      const vq = xbVaqt(r[37]); yoz(vq, '📄', no + ' · ' + qisq(r[23]), 'ijara · ' + (r[4] || ''), { t: 'shartnoma', v: no, mid: String(r[5] || '') }, r[5] ? 'mijoz:' + r[5] : 'sh:' + no, 'Ijara ' + no + ' tuzildi — ' + (r[4] || ''), 'shartnoma'); });
    c.skansiz.sort((a, b) => b.kun - a.kun); c.bepul.sort((a, b) => a.qolgan - b.qolgan);
    if (bor('shartnoma') && Object.keys(c.mid).length) (await oqi('02_Mijozlar', 11)).forEach(r => { const m = c.mid[st(r[0])]; if (!m || !sanami(r[10])) return; const q = -kunFarq(xbIso(r[10]));
      if (q <= XB_PASPORT_KUN && q > -3650) dq(q < 0 ? '#B42318' : '#DC6803', '<b>' + qisq(r[2]) + '</b> — pasport ' + (q < 0 ? 'muddati o\'tgan (' + dmy(xbIso(r[10])) + ')' : dmy(xbIso(r[10])) + ' da tugaydi (' + q + ' kun)') + ' · ' + m.no, { t: 'mijoz', v: st(r[0]) }, q < 0 ? 1 : 4); });
    return c; }, { bugun: 0, kecha: 0, oy: 0, skansiz: [], bepul: [], mid: {} });
  sh.skansiz.slice(0, 3).forEach(s => dq(s.kun >= 7 ? '#B42318' : '#DC6803', '<b>' + s.no + '</b> · ' + s.fish + ' — imzolangan skani ' + s.kun + ' kundan beri yo\'q', { t: 'shartnoma', v: s.no }, s.kun >= 7 ? 1 : 3));
  sh.bepul.slice(0, 2).forEach(s => dq('#1F4E78', '<b>' + s.no + '</b> · ' + s.fish + ' — bepul davri ' + s.qolgan + ' kunda tugaydi, mijoz bilan gaplashing', { t: 'shartnoma', v: s.no }, 5));

  // ---------- 5. devonxona (11)
  const dv = await blok('devon', async () => {
    const c = { ijroda: 0, yaqin: '', yuborilmagan: 0 }; if (!bor('devon')) return c;
    (await devonRows()).forEach(x => { const vq = xbVaqt(x.kiritildi); const meniki = men(x.kim);
      if (x.turi === 'Kirim') {
        const ij = men(x.ijrochi) || (x.yordam || []).some(men);
        if (ij && x.holati === 'Ijroda') { c.ijroda++; const mI = x.muddat ? xbIso(x.muddat) : ''; if (mI && (!c.yaqin || mI < c.yaqin)) c.yaqin = mI;
          if (mI && mI <= kun(XB_IJRO_KUN)) dq(mI < bugun ? '#B42318' : '#DC6803', '<b>Kirim xat №' + x.tartib + '</b> · ' + x.tashkilot + ' — ijro muddati ' + (mI < bugun ? 'o\'tdi (' + x.muddat + ')' : (mI === bugun ? 'bugun' : x.muddat)), { t: 'devon', v: x.id }, mI < bugun ? 0 : 2); }
        if (meniki) yoz(vq, '🏢', x.tashkilot, 'kirim xat №' + x.tartib, { t: 'devon', v: x.id }, 'devon:' + (x.raqam || x.id), 'Kirim xat №' + x.tartib + ' saqlandi — ' + x.tashkilot, 'devon');
      } else if (x.turi === 'Chiqim' && meniki) {
        if (x.holati === 'Tayyorlandi') { c.yuborilmagan++; const k = kunFarq(vq.iso); if (k >= XB_XAT_KUN) dq('#B42318', '<b>Chiquvchi xat ' + (x.raqam || '№' + x.tartib) + '</b> · ' + x.tashkilot + ' — ' + k + ' kundan beri yuborilmagan', { t: 'devon', v: x.id }, 1); }
        yoz(vq, '✍', x.tashkilot, 'chiquvchi xat ' + (x.raqam || '№' + x.tartib), { t: 'devon', v: x.id }, 'devon:' + (x.raqam || x.id), 'Chiquvchi xat ' + (x.raqam || '№' + x.tartib) + ' tayyorlandi — ' + x.tashkilot, 'devon'); } });
    return c; }, { ijroda: 0, yaqin: '', yuborilmagan: 0 });

  // ---------- 6. ogohlantirish xatlari (06e)
  const xt = await blok('xat', async () => {
    const c = { yetkazilmagan: 0 }; if (!bor('xat')) return c;
    (await oqi('06e_Xatlar', 21)).forEach(r => { if (!r[0] || !men(r[19])) return; const no = st(r[0]), vq = xbVaqt(r[20]);
      if (st(r[13]) === 'Tayyorlandi' && !r[17]) { c.yetkazilmagan++; const k = kunFarq(vq.iso); if (k >= XB_XAT_KUN) dq('#B42318', '<b>Xat ' + no + '</b> · ' + qisq(r[4]) + ' — ' + k + ' kundan beri yetkazilmagan', { t: 'xat', v: st(r[2]) }, 1); }
      yoz(vq, '✉', qisq(r[4]), 'ogohlantirish xati ' + no + ' · ' + r[2], { t: 'xat', v: st(r[2]) }, 'sh:' + r[2], 'Ogohlantirish xati ' + no + ' tayyorlandi — ' + r[2], 'xat'); });
    return c; }, { yetkazilmagan: 0 });

  // ---------- 7. undiruv (06, 03)
  const und = await blok('undiruv', async () => {
    const c = { muddati: 0, vada: 0 }; if (!bor('undiruv')) return c;
    (await oqi('03_Sotuv_shartnomalar', 32)).forEach(r => { if (!r[0] || /bekor/i.test(String(r[13] || '')) || !men(r[17])) return; if (num(r[31]) > 0) c.muddati++; });
    (await oqi('06_Undiruv_jurnali', 16)).forEach(r => { if (!r[0]) return; const vq = xbVaqt(r[10]);
      if (men(r[3]) && sanami(r[6]) && !String(r[15] || '').trim()) { const v = xbIso(r[6]); if (v <= kun(1)) { c.vada++; dq(v < bugun ? '#B42318' : '#DC6803', '<b>Va\'da ' + r[2] + '</b> · ' + qisq(r[12]) + ' — ' + (v < bugun ? 'muddati o\'tdi (' + dmy(v) + ')' : v === bugun ? 'bugun' : 'ertaga') + ', natijasini yozing', { t: 'und', v: st(r[2]) }, v < bugun ? 1 : 2); } }
      if (men(r[9])) yoz(vq, '📞', qisq(r[12]) || st(r[2]), st(r[2]) + ' · chora: ' + (r[4] || ''), { t: 'und', v: st(r[2]) }, 'sh:' + r[2], 'Chora yozildi — ' + r[2] + (r[4] ? ', ' + String(r[4]).toLowerCase() : ''), 'chora'); });
    return c; }, { muddati: 0, vada: 0 });

  // ---------- 8. hujjatlar (06d)
  await blok('hujjat', async () => { if (!bor('hujjat')) return; (await oqi('06d_Hujjatlar', 13)).forEach(r => { if (!r[0] || !men(r[11])) return; const vq = xbVaqt(r[12]);
    yoz(vq, '📎', st(r[1]) + (r[3] ? ' · ' + qisq(r[3]) : ''), 'skan: ' + (r[5] || ''), { t: 'shartnoma', v: st(r[1]) }, 'sh:' + r[1], 'Skan yuklandi — ' + (r[5] || 'hujjat') + ', ' + r[1], 'hujjat'); }); });

  // ---------- 9. bufer to'lovlar (05b)
  await blok('bufer', async () => { if (!bor('tolov')) return; (await oqi('05b_Bufer_tolovlar', 12)).forEach(r => { if (!r[0] || !men(r[9])) return; if (!/буфер|bufer/i.test(String(r[6] || ''))) return;
    const m = xbIso(r[7]); if (m && m < bugun) dq('#DC6803', '<b>Bufer to\'lov ' + r[2] + '</b> · ' + qisq(r[10]) + ' — kirim muddati o\'tdi (' + dmy(m) + ')', { t: 'bolim', v: 'tolov' }, 3); }); });

  // ---------- 10. ta'minot (09)
  const tm = await blok('taminot', async () => { const c = { kutmoqda: 0 }; if (!bor('taminot')) return c;
    const P = {};
    (await oqi('09_Taminot', 16)).forEach(r => { if (!r[0] || !men(r[11])) return; const h = String(r[13] || ''), p = String(r[1] || r[0]);
      const o = P[p] = P[p] || { kut: 0, rad: 0, sabab: '', vq: { srt: '' }, n: 0, mahsulot: String(r[5] || ''), taminotchi: String(r[4] || '') }; o.n++;
      if (/kutil/i.test(h)) o.kut++; if (/rad/i.test(h)) { o.rad++; if (!o.sabab && r[15]) o.sabab = String(r[15]).replace(/\s+/g, ' ').slice(0, 70); }
      const vq = xbVaqt(r[12]); if (vq.srt > o.vq.srt) o.vq = vq; });
    Object.keys(P).forEach(p => { const o = P[p]; if (o.kut) c.kutmoqda++;
      if (o.rad) dq('#B42318', '<b>Partiya ' + p + '</b> — ' + o.rad + ' ta mahsulot rad etildi' + (o.sabab ? ': ' + o.sabab : ''), { t: 'bolim', v: 'taminot' }, 1);
      yoz(o.vq, '📦', 'Partiya ' + p, o.n + ' ta mahsulot · ' + o.taminotchi, { t: 'bolim', v: 'taminot' }, 'tm:' + p, 'Mahsulot kiritildi — partiya ' + p + ', ' + o.n + ' ta', 'taminot'); });
    return c; }, { kutmoqda: 0 });

  // ---------- 11. yurist (06b)
  const yu = await blok('yurist', async () => { const c = { faol: 0, mib: 0 }; if (!bor('yurist')) return c;
    (await oqi('06b_Yuridik_ishlar', 21)).forEach(r => { if (!r[0]) return; if (st(r[14]) !== 'Faol') return; c.faol++; if (Number(r[19]) >= 7) c.mib++; });
    return c; }, { faol: 0, mib: 0 });

  // ---------- 12. ▶ bugungi ish — faqat undiruvchi (admin emas)
  const qd = await blok('qadam', async () => (bor('undiruv') && !adm) ? await require('./qadam')._ichki.qadamXulosa(u.kod, u.fish, bugun) : null, null);
  if (qd) {
    const qolgan = Math.max(0, qd.maqsad - qd.bajarildi);
    if (qd.navbat && qolgan) dq(qd.qizil ? '#B42318' : '#DC6803', '<b>▶ Bugungi ish: ' + qd.bajarildi + ' / ' + qd.maqsad + '</b> — yana ' + qolgan + ' ta mijoz kerak, navbatda ' + qd.navbat + ' ta. Eng muhimidan boshlang', { t: 'bolim', v: 'qadam' }, 0);
    if (qd.davo) dq('#B42318', '<b>' + qd.davo + ' ta mijozda da\'vo muddati tugayapti</b> (90 kundan kam qoldi) — ▶ Bugungi ish navbatida', { t: 'bolim', v: 'qadam' }, 1);
  }

  // ---------- ko'rsatkichlar
  const kpi = [];
  const tk = top || { kechikkan: 0, bugun: 0, ochiq: 0, tekshiruv: 0 };
  if (qd) {
    kpi.push({ k: 'qadam', nom: '▶ Bugungi ish', q: qd.bajarildi + ' / ' + qd.maqsad, iz: qd.bajarildi >= qd.maqsad ? 'reja bajarildi ✅' : (qd.navbat ? qd.navbat + ' ta mijoz navbatda' : 'navbat tugadi'), cls: qd.bajarildi >= qd.maqsad ? '' : 's', och: { t: 'bolim', v: 'qadam' } });
    kpi.push({ k: 'qizil', nom: '🔴 Bugun shart', q: qd.qizil, iz: 'mijozda bugungi buyruq', cls: qd.qizil ? 'q' : '', och: { t: 'bolim', v: 'qadam' } });
    kpi.push({ k: 'buz', nom: "Va'dasi buzilgan", q: qd.buzilgan, iz: qd.buzilgan ? "bugun qo'ng'iroq qiling" : 'yo\'q ✅', cls: qd.buzilgan ? 's' : '', och: { t: 'bolim', v: 'qadam' } });
    kpi.push({ k: 'jim', nom: '30+ kun aloqa yo\'q', q: qd.jim, iz: 'portfel ' + qd.portfel + ' ta', cls: qd.jim ? 's' : '', och: { t: 'bolim', v: 'qadam' } });
    kpi.push({ k: 'kech', nom: "Muddati o'tgan topshiriq", q: tk.kechikkan, iz: tk.kechikkan ? 'darhol bajaring' : 'hammasi vaqtida ✅', cls: tk.kechikkan ? 'q' : '', och: { t: 'topshiriq' } });
  } else {
    kpi.push({ k: 'kech', nom: "Muddati o'tgan ishlar", q: tk.kechikkan, iz: tk.kechikkan ? 'darhol bajaring' : 'hammasi vaqtida ✅', cls: tk.kechikkan ? 'q' : '', och: { t: 'topshiriq' } });
    kpi.push({ k: 'bugun', nom: 'Bugun bajarish kerak', q: tk.bugun, iz: tk.tekshiruv ? tk.tekshiruv + ' ta tekshiruvda' : 'muddati bugun', cls: '', och: { t: 'topshiriq' } });
  }
  if (bor('devon')) rol.push({ k: 'devon', nom: 'Ijrodagi kirim xatlar', q: dv.ijroda, iz: dv.yaqin ? 'eng yaqini — ' + (dv.yaqin === bugun ? 'bugun' : dv.yaqin < bugun ? 'muddati o\'tdi' : dmy(dv.yaqin)) : (dv.yuborilmagan ? dv.yuborilmagan + ' ta chiquvchi xat yuborilmagan' : 'ijroda xat yo\'q'), cls: dv.yaqin && dv.yaqin <= kun(XB_IJRO_KUN) ? 's' : '', och: { t: 'bolim', v: 'devon' } });
  if (bor('tolov')) rol.push({ k: 'kiritdim', nom: 'Bugun kiritdim', q: bor('tashrif') ? tolov.bugun + ' / ' + tash.bugun : tolov.bugun, iz: bor('tashrif') ? "to'lov / tashrif" : "to'lov · kecha " + tolov.kecha, cls: '', och: { t: 'bolim', v: 'tolov' } });
  if (bor('shartnoma') || bor('hujjat')) rol.push({ k: 'skansiz', nom: "Skani yo'q shartnomalar", q: sh.skansiz.length, iz: sh.skansiz.length ? 'men tuzgan, muddati o\'tgan' : 'hammasi yuklangan ✅', cls: sh.skansiz.length ? 's' : '', och: { t: 'bolim', v: bor('hujjat') ? 'hujjat' : 'mijoz' } });
  if ((bor('tashrif') || bor('shartnoma')) && !bor('tolov')) rol.push({ k: 'tashsh', nom: 'Bugun: tashrif / shartnoma', q: tash.bugun + ' / ' + sh.bugun, iz: 'kecha ' + tash.kecha + ' / ' + sh.kecha, cls: '', och: { t: 'bolim', v: bor('tashrif') ? 'tashrif' : 'shartnoma' } });
  if (bor('shartnoma')) rol.push({ k: 'oy', nom: 'Bu oy tuzdim', q: sh.oy, iz: 'shartnoma', cls: '', och: { t: 'bolim', v: 'shartnoma' } });
  if (bor('undiruv')) rol.push({ k: 'und', nom: "Portfelim: muddati o'tgan", q: und.muddati, iz: und.vada ? und.vada + ' ta va\'da kutmoqda' : 'shartnoma', cls: und.vada ? 's' : '', och: { t: 'bolim', v: 'undiruv' } });
  if (bor('xat')) rol.push({ k: 'xat', nom: 'Yetkazilmagan xatlar', q: xt.yetkazilmagan, iz: xt.yetkazilmagan ? 'imzolatib yetkazing' : 'hammasi yetkazilgan ✅', cls: xt.yetkazilmagan ? 's' : '', och: { t: 'bolim', v: 'xat' } });
  if (bor('yurist')) rol.push({ k: 'yu', nom: 'Yurist ishlari', q: yu.faol, iz: yu.mib + ' ta MIB da', cls: '', och: { t: 'bolim', v: 'yurist' } });
  if (bor('taminot')) rol.push({ k: 'tm', nom: 'Tasdiq kutayotgan partiyalar', q: tm.kutmoqda, iz: "ta'minot", cls: tm.kutmoqda ? 's' : '', och: { t: 'bolim', v: 'taminot' } });
  if (!qd) rol.slice(0, 2).forEach(x => kpi.push(x));

  diqqat.sort((a, b) => a.t - b.t);
  OX.sort((a, b) => a.srt < b.srt ? 1 : -1);
  const ox = [], bor2 = {}; for (const o of OX) { if (bor2[o.kalit]) continue; bor2[o.kalit] = 1; ox.push({ ik: o.ik, nom: o.nom, iz: o.iz, och: o.och }); if (ox.length >= XB_OXIRGI) break; }
  QL.sort((a, b) => a.srt < b.srt ? -1 : 1);

  const d = new Date(bugun + 'T12:00:00Z');
  return { ok: true, fish: u.fish, ism: xbIsm(u.fish), bugun, sana: XB_KUNLAR[d.getUTCDay()] + ', ' + d.getUTCDate() + '-' + XB_OYLAR[d.getUTCMonth()] + ' ' + d.getUTCFullYear(),
    huquq: H, top, kpi, diqqat: diqqat.slice(0, XB_DIQQAT).map(x => ({ rang: x.rang, matn: x.matn, och: x.och })),
    oxirgi: ox, qildim: { royxat: QL.slice(-XB_QILDIM), jami }, xato,
    qadam: qd ? { bajarildi: qd.bajarildi, maqsad: qd.maqsad, navbat: qd.navbat, qizil: qd.qizil } : null };
}

module.exports = { xodimBosh };
