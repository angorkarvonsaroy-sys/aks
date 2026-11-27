// AKS TIZIM — 🗺 Xarita: xaritaMalumot (Kod.gs v9.7 «5-BO'LIM: XARITA») serverda. Faqat o'qiydi; natija eski tizim bilan bir xil.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const ST = require('./sotuv')._ichki;
const { xHolat } = require('../lib/dokon');

const num = x => { const n = Number(x); return isNaN(n) ? 0 : Math.round(n); };   // Kod.gs num_
// ustunA_oxiri_
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const xom = (x, n) => { const o = []; for (let i = 0; i < n; i++) o.push(x[i] == null ? '' : x[i]); return o; };       // getValues: bo'sh katak — ''
const kor = (r, n) => { const o = []; for (let i = 0; i < n; i++) o.push(r[i] == null ? '' : String(r[i])); return o; }; // getDisplayValues

async function xaritaMalumot([kodSes]) {
  const u = await S.ruxsat(kodSes);
  const mol = u.huquq.includes('admin') || u.huquq.includes('xarita_moliya');
  if (!mol && !u.huquq.includes('xarita')) throw new S.Xato('Xaritaga ruxsatingiz yo\'q. Direktorga murojaat qiling.');
  const [R1, R4, R3] = await Promise.all([V.qatorlar('01_Dokonlar'), V.qatorlar('04_Ijara_shartnomalar'), mol ? V.qatorlar('03_Sotuv_shartnomalar') : []]);
  const v = R1.filter(z => z.n <= 641).map(z => xom(z.x, 30)).filter(r => r[0]);
  const S3 = {}, S4 = {};
  // 04 AC (bepul davr tugashi) — ko'ringan matndan emas, xom qiymatdan «dd.MM.yyyy» (02.11.2026, 3-bosqichga tayyorgarlik; aks-baza xom: 0 farq)
  aOxiri(R4).forEach(({ r: r0, x: x0 }) => { const r = kor(r0, 37); r[28] = V.korSana(x0[28]); if (r[0]) S4[String(r[0])] = r; });
  if (mol) aOxiri(R3).forEach(({ x }) => { const r = xom(x, 40); if (r[0]) S3[String(r[0])] = r; });
  const BR = {};
  try { (await ST.bronRoyxat(V.bugun())).forEach(z => { if (z.holati === 'Faol' && z.dokon) BR[z.dokon.trim().toUpperCase()] = z; }); }
  catch (e) { /* 01d_Bronlar hali yo'q — bron yo'q deb hisoblanadi */ }
  const dokonlar = v.map(r => {
    const br = BR[String(r[0]).trim().toUpperCase()];
    const o = { id: String(r[0]), holat: xHolat(r, !!br), maydon: Number(r[5]) || 0, faoliyat: String(r[23] || ''), savdo: String(r[24] || ''), xona: String(r[29] || ''),
      egasi: String(r[18] || ''), sotuvNo: String(r[17] || ''), ijara: String(r[21] || '') };
    // ijara turi (rang uchun, hammaga): mchj | biz (egasi nomidan, tilxat bilan) | egasi (egasi o'zi bergan) | ozi (egasi o'zi ishlatyapti)
    const ij0 = S4[o.ijara];
    if (o.ijara) { const g = ij0 ? String(ij0[6] || '') : ''; o.ijTur = /o'?zi ishlat/i.test(g) ? 'ozi' : (g === 'MChJ' || o.egasi === 'SOTILMAGAN') ? 'mchj' : (ij0 && String(ij0[7] || '').trim() ? 'biz' : 'egasi'); } else o.ijTur = '';
    if (mol) {
      Object.assign(o, { ijarachi: String(r[22] || ''), taqiq: String(r[8]) === 'Ha', rais: String(r[11]) === 'Ha', baza: Number(r[6]) || 0, umumiy: Number(r[15]) || 0,
        zona: r[16] === '' ? '' : Number(r[16]), hisobQiymat: Number(r[27]) || 0 });
      const s = S3[o.sotuvNo];
      if (s) Object.assign(o, { egasiId: String(s[4] || ''), shHolat: String(s[13] || ''), undiruvchi: String(s[17] || ''), narx: num(s[7]),
        shQiymat: num(s[25]), qarz: num(s[30]), muddati: num(s[31]), oylik: num(s[26]) });
      const ij = S4[o.ijara];
      if (ij) Object.assign(o, { ijarachiId: String(ij[5] || ''), beruvchi: String(ij[6] || ''), ijBosh: String(ij[9] || ''), ijTug: String(ij[10] || ''),
        bepulTug: String(ij[28] || ''), ijOylik: Number(String(ij[14] || '').replace(/[^\d]/g, '')) || 0 });
    } else { o.egasi = o.egasi === 'SOTILMAGAN' ? 'SOTILMAGAN' : '*'; o.sotuvNo = o.sotuvNo ? '*' : ''; o.ijara = o.ijara ? '*' : ''; }
    if (br && o.holat === 'Bron') o.bron = { id: br.id, fish: br.fish, tel: mol ? br.tel : '*', sana: br.sana, tugash: br.tugash, qoldi: br.qoldi, kim: br.kim, ogoh: br.ogoh };
    return o;
  });
  // 28.11.2026: bo'lingan do'konlar (H-1-2A / H-1-2B) — xaritada hali bitta katak «H-1-2». Xarita qayta chizilguncha ota-katakka
  // ikkala bo'lakning jamlangan holati beriladi: ikkalasi bo'sh → Bo'sh; bittasi sotilgan/ijarada → o'sha; maydon — yig'indi; egasi — ikkalasi.
  const ota = {};
  dokonlar.forEach(o => { const m = /^(.+?)([AB])$/.exec(o.id); if (!m || !/-\d+$/.test(m[1])) return; (ota[m[1]] = ota[m[1]] || []).push(o); });
  const DAR = { 'Sotilgan+ijara': 5, 'Sotilgan': 4, "Bo'sh+ijara": 3, 'Bron': 2, "Bo'sh": 1, "Ma'muriyat": 0 };
  Object.keys(ota).forEach(id => { const L = ota[id].slice().sort((a, b) => (DAR[b.holat] || 0) - (DAR[a.holat] || 0)); if (dokonlar.some(o => o.id === id)) return;
    const o = Object.assign({}, L[0], { id, maydon: Math.round(L.reduce((a, x) => a + x.maydon, 0) * 1000) / 1000, bolaklar: L.map(x => x.id + ': ' + x.holat),
      egasi: [...new Set(L.map(x => x.egasi).filter(Boolean))].join(' / ') });
    dokonlar.push(o); });
  return { moliya: mol, dokonlar };
}

module.exports = { xaritaMalumot };
