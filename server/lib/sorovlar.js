// AKS TIZIM — ⏳ OCHIQ SO'ROVLAR (v27.178, 20.11.2026, direktor qarori).
// Bitta manba: shartnoma bo'yicha hozir kimningdir javobini kutayotgan so'rovlar — har joyda (topshiriq, mijoz kartasi,
// shartnomalar ro'yxati, shartnoma kartasi) bir xil ko'rsatiladi: xodim so'rov ketganini bilsin, ikkinchi marta bosmasin.
// Manbalar (ko'zgu):
//   06m_Kelishuv_bekor  — «Tasdiq kutilmoqda» (direktor); «Hujjat tayyorlandi» (ijarachi imzosi kutilmoqda)
//   06l_Imzosiz_sorovlar — «Kutilmoqda» (direktor)
//   06h_Bekor_sorovlari  — «Hujjatlar kutilmoqda» / «Tasdiq kutilmoqda» (sotuv shartnomasini ✂ bekor qilish)
//   06b_Yuridik_ishlar   — «Tasdiq kutilmoqda» (yuristga o'tkazish — direktor)
//   06k_Qayta_tuzish     — «Loyiha» / «Qaytarildi» (ijrochi hujjat va skan yuklaydi) · «Tekshiruvda» (direktor) · «Yozilmoqda»
// Natija: { [shartnoma_no]: [ { manba, id, tur, kim, vaqt, holat, matn, qayta? } ] } — eng yangisi birinchi.
'use strict';
const V = require('./varaq');

const s = v => (v === null || v === undefined) ? '' : String(v).trim();
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const oxirgiVaqt = (tarix, vaqt) => (String(tarix || '').match(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/g) || []).pop() || s(vaqt);

async function ochiqSorovlar() {
  const M = {};
  const qosh = (no, z) => { no = s(no); if (!no) return; (M[no] = M[no] || []).push(z); };
  const oqi = async nom => { try { return aOxiri(await V.qatorlar(nom)).map(z => z.r || z.x || []); } catch (e) { return []; } };

  // 06m — kelishuv / ijarachi kelmadi / do'kon ochilmadi
  (await oqi('06m_Kelishuv_bekor')).forEach(r => {
    const h = s(r[12]), turi = s(r[24]);
    const nom = turi === 'Kelmadi' ? 'Ijarachi kelmadi — bir tomonlama bekor qilish' : turi === 'Ochilmagan' ? 'Do\'kon 5 kunda ochilmadi — bekor qilish' : 'Kelishuv bilan bekor qilish';
    if (h === 'Tasdiq kutilmoqda') qosh(r[2], { manba: '06m', id: s(r[0]), tur: nom, kim: 'direktor', vaqt: oxirgiVaqt(r[22], r[1]), holat: h, matn: nom + ' so\'rovi direktorga yuborildi — tasdiq kutilmoqda' });
    else if (h === 'Hujjat tayyorlandi') qosh(r[2], { manba: '06m', id: s(r[0]), tur: 'Kelishuv hujjati tayyor', kim: 'ijarachi', vaqt: s(r[1]), holat: h, matn: 'Kelishuv hujjati tayyorlangan — ijarachining imzosi va skan kutilmoqda' });
  });
  // 06l — imzolanmagan shartnoma
  (await oqi('06l_Imzosiz_sorovlar')).forEach(r => {
    if (s(r[7]) === 'Kutilmoqda') qosh(r[2], { manba: '06l', id: s(r[0]), tur: 'Imzolanmagan shartnoma — bekor qilish', kim: 'direktor', vaqt: s(r[1]), holat: 'Kutilmoqda', matn: 'Imzolanmagan shartnomani bekor qilish so\'rovi direktorga yuborildi — tasdiq kutilmoqda' });
  });
  // 06h — sotuv shartnomasini ✂ bekor qilish
  (await oqi('06h_Bekor_sorovlari')).forEach(r => {
    const h = s(r[6]);
    if (h === 'Tasdiq kutilmoqda') qosh(r[1], { manba: '06h', id: s(r[0]), tur: 'Sotuv shartnomasini bekor qilish', kim: 'direktor', vaqt: s(r[25]), holat: h, matn: 'Bekor qilish so\'rovi (buyruq va xabarnoma skanlari bilan) direktorga yuborildi — tasdiq kutilmoqda' });
    else if (h === 'Hujjatlar kutilmoqda') qosh(r[1], { manba: '06h', id: s(r[0]), tur: 'Sotuv shartnomasini bekor qilish', kim: 'xodim', vaqt: s(r[25]), holat: h, matn: 'Bekor qilish boshlangan — buyruq va xabarnoma skanlari yuklanishi kutilmoqda' });
  });
  // 06b — yuristga o'tkazish
  (await oqi('06b_Yuridik_ishlar')).forEach(r => {
    if (s(r[14]) === 'Tasdiq kutilmoqda') qosh(r[1], { manba: '06b', id: s(r[0]), tur: 'Yuristga o\'tkazish', kim: 'direktor', vaqt: s(r[28]), holat: 'Tasdiq kutilmoqda', matn: 'Yuristga o\'tkazish so\'rovi direktorga yuborildi — tasdiq kutilmoqda' });
  });
  // 06k — qayta tuzish loyihasi
  (await oqi('06k_Qayta_tuzish')).forEach(r => {
    const h = s(r[2]); if (['Loyiha', 'Qaytarildi', 'Tekshiruvda', 'Yozilmoqda'].indexOf(h) < 0) return;
    const sk = { ariza: !!s(r[21]), kelishuv: !!s(r[22]), solishtirma: !!s(r[23]), shartnoma: !!s(r[24]) };
    const yoq = Object.keys(sk).filter(k => !sk[k]);
    const z = { manba: '06k', id: s(r[0]), tur: 'Qayta tuzish (' + s(r[3]) + ' → ' + s(r[4]) + ')', kim: h === 'Tekshiruvda' ? 'direktor' : 'ijrochi', vaqt: s(r[26]) || s(r[1]), holat: h,
      qayta: { id: s(r[0]), eskiNo: s(r[3]), yangiNo: s(r[4]), holati: h, ijrochi: s(r[18]), yaratdi: s(r[19]), yaratildi: s(r[1]), skan: sk, skanYoq: yoq },
      matn: h === 'Tekshiruvda' ? 'Qayta tuzish loyihasi direktor tekshiruvida — tasdiq kutilmoqda'
        : h === 'Yozilmoqda' ? 'Qayta tuzish — bazaga yozilmoqda'
        : 'Qayta tuzish jarayonda — ijrochi ' + (s(r[18]) || '—') + ': ' + (yoq.length ? 'skan yuklanishi kutilmoqda (' + yoq.join(', ') + ')' : 'hamma skan yuklangan, tekshiruvga yuborish kutilmoqda') };
    qosh(r[3], z);
    if (s(r[4])) qosh(r[4], z);
  });
  Object.keys(M).forEach(no => M[no].sort((a, b) => (b.vaqt || '').localeCompare(a.vaqt || '')));
  return M;
}

// Kutish belgisi uchun qisqa shakl (ilova chip): direktor tasdig'ini kutayotgan so'rov bo'lsa — o'sha, bo'lmasa eng yangisi
function qisqa(L) { if (!L || !L.length) return null; const d = L.find(z => z.kim === 'direktor') || L[0]; return { manba: d.manba, id: d.id, tur: d.tur, kim: d.kim, vaqt: d.vaqt, holat: d.holat, matn: d.matn, qayta: d.qayta || null }; }

module.exports = { ochiqSorovlar, qisqa };
