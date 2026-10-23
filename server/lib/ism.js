// AKS TIZIM — ismni kirillga o'girish va qisqartirish (Xat.gs xatKirill_, Undiruv.gs undQisqaIsm_ bilan bir xil).
'use strict';
// 24.10.2026 tuzatish (direktor): otasining ismidan keyingi «ўғли» / «қизи» — KICHIK harf bilan. Eski xatKirill_ har so'zni bosh harf
// bilan yozardi → «Тестов Жасур Бахтиёр Ўғли» (2-xat salomi, F.I.Sh. qatori, bekor/kelishuv hujjatlari, Telegram). Birinchi so'z (familiya) tegilmaydi.
const OTA = /^(ўғли|қизи|угли|кизи|огли|оглы|кызы)$/i;
const otaKichik = t => t.split(' ').map((w, i) => i && OTA.test(w) ? w.toLowerCase() : w).join(' ');
// xatKirill_: «ODILOVA RANO ABDUXAKIMOVNA» → «Одилова Рано Абдухакимовна»; kirill harfi bor matn o'zgarmaydi (faqat «ўғли»/«қизи» kichik harfga)
function xatKirill(matn) {
  matn = String(matn || '').trim(); if (!matn) return matn;
  if (/[Ѐ-ӿ]/.test(matn)) return otaKichik(matn);
  // «Oʼ» / «Gʼ» (U+02BC — telefon klaviaturasi) ham: avval «ОЪ»/«ГЪ» bo'lib qolardi
  const J = [['O`', 'Ў'], ["O'", 'Ў'], ['Oʻ', 'Ў'], ['O‘', 'Ў'], ['O’', 'Ў'], ['Oʼ', 'Ў'], ['G`', 'Ғ'], ["G'", 'Ғ'], ['Gʻ', 'Ғ'], ['G‘', 'Ғ'], ['G’', 'Ғ'], ['Gʼ', 'Ғ'], ['SH', 'Ш'], ['CH', 'Ч'], ['KH', 'Х'], ['YE', 'Е'], ['YO', 'Ё'], ['YU', 'Ю'], ['YA', 'Я'], ['TS', 'Ц']];
  const B = { A: 'А', B: 'Б', D: 'Д', E: 'Е', F: 'Ф', G: 'Г', H: 'Ҳ', I: 'И', J: 'Ж', K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', Q: 'Қ', R: 'Р', S: 'С', T: 'Т', U: 'У', V: 'В', X: 'Х', Y: 'Й', Z: 'З', C: 'К', W: 'В' };
  let t = matn.toUpperCase(); J.forEach(p => { t = t.split(p[0]).join(p[1]); });
  t = t.replace(/['`ʼʻ‘’]/g, 'Ъ');
  t = t.replace(/(^|[^A-ZЀ-ӿ])E/g, '$1Э');
  t = t.split('').map(ch => B[ch] || ch).join('');
  return otaKichik(t.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '));
}
// undQisqaIsm_: «ODILOVA RANO ABDUXAKIMOVNA» → «Одилова Р.А.»; «… BAXTIYOR O'G'LI» → «… Ж.Б.» («ўғли»/«қизи» bosh harfga olinmaydi — 24.10)
function qisqaIsm(fish) {
  const w = String(fish || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return '';
  const k = xatKirill(w.join(' ')).split(/\s+/).filter((z, i) => !i || !OTA.test(z));
  return k[0] + (k.length > 1 ? ' ' + k.slice(1).map(z => z.charAt(0) + '.').join('') : '');
}
module.exports = { xatKirill, qisqaIsm };
