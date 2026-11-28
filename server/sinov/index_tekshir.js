#!/usr/bin/env node
// AKS TIZIM — 🧪 ilova sahifasi (Index.html / Xarita.html) ichidagi skriptlar sintaksisi. Sahifa buzuq bo'lsa hech bir xodim kira olmaydi —
// shuning uchun yangi sahifa o'rnatilishidan oldin tekshiriladi.  node index_tekshir.js <fayl.html> …   → 0 — sog'; 2 — sintaksis xatosi yoki tugmaga bog'langan funksiya ta'riflanmagan.
'use strict';
const fs = require('fs'), vm = require('vm');
let yomon = 0;
for (const f of process.argv.slice(2)) {
  let s; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { console.log('  sahifa o\'qilmadi: ' + f); continue; }
  if (s.length < 1000) { console.log('  ✗ ' + f + ': sahifa juda qisqa (' + s.length + ' belgi) — buzuq'); yomon++; continue; }
  const B = []; s.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, (m, a, kod) => { if (!/type\s*=\s*["']?(text\/template|application\/json)/i.test(a)) B.push(kod); return m; });
  let n = 0;
  B.forEach((kod, i) => { const k = kod.replace(/<\?!?=[\s\S]*?\?>/g, 'null'); if (!k.trim()) return; n++;
    try { new vm.Script(k, { filename: f + '#skript' + (i + 1) }); }
    catch (e) { yomon++; console.log('  ✗ ' + f.split('/').pop() + ' — ' + (i + 1) + '-skript: ' + e.name + ': ' + e.message + (e.stack ? ' (' + String(e.stack).split('\n')[0].replace(/^.*#skript\d+:?/, 'qator ') + ')' : '')); } });
  if (!yomon) console.log('  ' + f.split('/').pop() + ': ' + n + ' ta skript, sintaksis sog\'');
}
// 14.11.2026: TUGMAGA BOG'LANGAN FUNKSIYA TA'RIFLANGANMI (onclick="fn(…)" va shu kabi). v27.78 da «qyAriza» funksiyasining ta'rifi tushib qolgan, chaqiruvi
// esa qolgan — «📄 Mijoz arizasi» tugmasi 8 kun davomida hech narsa qilmagan, buni hech kim bilmagan. Endi bunday sahifa o'rnatilmaydi.
// Ta'riflar hamma berilgan sahifalardan birga yig'iladi (Index ↔ Xarita bir-birining funksiyalarini chaqiradi). Index dagi topilmagan nom — xato (2);
// boshqa sahifadagisi — faqat ogohlantirish (u sahifa bu yerda sinalmagan).
const ICHKI = new Set('if for while switch return typeof new function alert confirm prompt setTimeout clearTimeout setInterval clearInterval parseInt parseFloat Number String Boolean Math Date JSON Object Array event this document window location history navigator console encodeURIComponent decodeURIComponent isNaN isFinite void delete catch try else do in of Promise fetch requestAnimationFrame open close print scrollTo getComputedStyle RegExp Error Symbol Map Set'.split(' '));
function tarifNomlari(s) { const D = new Set(); let m;
  const R = [/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g, /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g, /[,;{]\s*([A-Za-z_$][\w$]*)\s*=\s*(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g];
  R.forEach(re => { while ((m = re.exec(s))) D.add(m[1]); }); return D; }
function tugmaChaqiruvlari(s) { const C = {}; let m;
  const re = /on(?:click|change|input|toggle|keyup|keydown|keypress|submit|blur|focus|touchstart|pointerdown|mousedown)\s*=\s*(\\?['"])([\s\S]{0,400}?)\1/g;
  while ((m = re.exec(s))) { const q = m[2], ri = /(?:^|[;{}?:&|!=(,\s])\s*([A-Za-z_$][\w$]*)\s*\(/g; let k;
    while ((k = ri.exec(q))) { const nom = k[1], bosh = k.index + k[0].indexOf(nom); if (ICHKI.has(nom)) continue; if (/[.\w$]$/.test(q.slice(0, bosh))) continue;
      (C[nom] = C[nom] || []).push(s.slice(0, m.index).split('\n').length); } }
  return C; }
{ const SAH = []; for (const f of process.argv.slice(2)) { try { const s = fs.readFileSync(f, 'utf8'); if (s.length >= 1000) SAH.push({ f, s }); } catch (e) { } }
  const D = new Set(); SAH.forEach(z => tarifNomlari(z.s).forEach(n => D.add(n)));
  SAH.forEach(z => { const C = tugmaChaqiruvlari(z.s), yoq = Object.keys(C).filter(n => !D.has(n)), nom = z.f.split('/').pop(), asosiy = /index/i.test(nom);
    if (!yoq.length) { console.log('  ' + nom + ': tugmalarga bog\'langan ' + Object.keys(C).length + ' ta funksiya — hammasi ta\'riflangan'); return; }
    yoq.forEach(n => console.log('  ' + (asosiy ? '✗' : '⚠') + ' ' + nom + ': tugmaga bog\'langan «' + n + '» funksiyasi ta\'riflanmagan (qator ' + [...new Set(C[n])].slice(0, 4).join(', ') + ') — tugma bosilganda hech narsa bo\'lmaydi'));
    if (asosiy) yomon += yoq.length; }); }
// 19.11.2026: «//» izohi o'sha qatordagi KODNI yutib yuborgan holat. v27.137 da shunday bo'lgan:
//   if(...) return ...;   // izoh ... const kech=g.filter(...)   ← «const kech» izohning ichida qolgan
// Sintaksis sog' ko'rinadi (node --check o'tadi), lekin ishlaganda «kech is not defined» chiqadi va ekran to'xtaydi.
{ for (const f of process.argv.slice(2)) { let s; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const nom = f.split('/').pop();
    s.split('\n').forEach((l, i) => {
      const m = /\/\/[^\n]*?\b(const|let|var|return|function|if|for|while)\s/.exec(l); if (!m) return;
      const old = l.slice(0, m.index);
      if (old.endsWith(':') || /[:=]\s*["'`]?$/.test(old)) return;           // http:// va shunga o'xshash
      if ((old.match(/'/g) || []).length % 2 || (old.match(/"/g) || []).length % 2 || (old.match(/`/g) || []).length % 2) return;   // satr ichida
      console.log('  ✗ ' + nom + ': ' + (i + 1) + '-qatorda «//» izohidan keyin shu qatorda kod qolib ketgan — izoh uni yutib yuboradi:');
      console.log('      ' + l.slice(m.index, m.index + 120).trim());
      yomon++; }); } }

// 27.11.2026: SKRIPT ICHIDA CHAQIRILGAN, LEKIN HECH QAYERDA TA'RIFLANMAGAN FUNKSIYA. v27.192–194 da Прайс ekrani «esc(…)» ni chaqirgan
// (to'g'risi thEsc) — sintaksis sog', tugma funksiyasi (sotuvPrays) ta'riflangan, lekin ichkarida «esc is not defined» — 3 kun hech kimda
// ochilmagan. Yuqoridagi tekshiruv faqat onclick="…" ni ko'radi; bu esa butun kodni daraxt (acorn) orqali o'qiydi, satr ichidagi matnga
// aldanmaydi. acorn topilmasa — qadam o'tkazib yuboriladi va aytiladi (xato emas).
{ let acorn = null, walk = null;
  for (const y of ['acorn', '/opt/node-tools/node_modules/acorn', '/opt/npm-tools/node_modules/acorn']) { try { acorn = require(y); walk = require(y.replace(/acorn$/, 'acorn-walk')); break; } catch (e) { } }
  if (!acorn) console.log('  ⚠ acorn topilmadi — «ta\'riflanmagan funksiya» tekshiruvi o\'tkazib yuborildi');
  else {
    const GLOBAL = new Set([...ICHKI, ...'encodeURI decodeURI cancelAnimationFrame TypeError RangeError WeakMap WeakSet Blob File FileReader URL FormData XMLHttpRequest Image Audio Uint8Array Int32Array Float64Array ArrayBuffer DataView atob btoa escape unescape google structuredClone queueMicrotask localStorage sessionStorage matchMedia addEventListener removeEventListener dispatchEvent CustomEvent Event KeyboardEvent MouseEvent MutationObserver IntersectionObserver ResizeObserver AbortController Headers Request Response TextEncoder TextDecoder Intl Proxy Reflect BigInt Function Date Infinity NaN undefined globalThis self parent top frames QRCode html2canvas jspdf pdfjsLib eval arguments'.split(' ')]);
    const SAH = []; for (const f of process.argv.slice(2)) { try { const s = fs.readFileSync(f, 'utf8'); if (s.length >= 1000) SAH.push({ f, s }); } catch (e) { } }
    const skriptlar = z => { const B = []; z.s.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, (m, a, kod, off) => { if (!/type\s*=\s*["']?(text\/template|application\/json)/i.test(a)) B.push({ kod: kod.replace(/<\?!?=[\s\S]*?\?>/g, 'null'), qator: z.s.slice(0, off + m.indexOf(kod)).split('\n').length - 1 }); return m; }); return B; };
    const patNom = (n, D) => { if (!n) return; if (n.type === 'Identifier') D.add(n.name); else if (n.type === 'ObjectPattern') n.properties.forEach(p => patNom(p.type === 'RestElement' ? p.argument : p.value, D)); else if (n.type === 'ArrayPattern') n.elements.forEach(e => patNom(e, D)); else if (n.type === 'AssignmentPattern') patNom(n.left, D); else if (n.type === 'RestElement') patNom(n.argument, D); };
    const D = new Set(), G = new Set(), CH = [], SC = new WeakMap();   // ta'riflar (hamma sahifadan), «typeof x==='function'» bilan himoyalanganlar, chaqiruvlar
    SAH.forEach(z => skriptlar(z).forEach((b, i) => { let ast; try { ast = acorn.parse(b.kod, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true }); } catch (e) { return; }
      // 28.11.2026: QAMROV hisobga olinadi. Avval hamma ta'rif bitta to'plamga yig'ilardi — ochChiz() ichidagi «const dmy» prChiz() dagi dmy() ni
      // «ta'riflangan» qilib ko'rsatdi, Прайс esa ReferenceError bilan yiqildi. Endi: funksiya/blok ichidagi ta'rif faqat o'sha qamrov ichidagi
      // chaqiruvni qoplaydi; Program (sahifa) darajasidagi ta'rif, window.x= va e'lon qilinmagan o'zgaruvchiga yozish — hamma joyda (D).
      const QAM = n => n && (n.type === 'Program' || n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
      const BLOK = n => QAM(n) || (n && (n.type === 'BlockStatement' || n.type === 'ForStatement' || n.type === 'ForInStatement' || n.type === 'ForOfStatement' || n.type === 'SwitchStatement' || n.type === 'CatchClause' || n.type === 'StaticBlock'));
      const qoy = (nom, qam) => { if (!nom) return; if (!qam || qam.type === 'Program') D.add(nom); else { let S = SC.get(qam); if (!S) SC.set(qam, S = new Set()); S.add(nom); } };
      const topQam = (anc, test, tashla) => { for (let i = anc.length - 1 - (tashla ? 1 : 0); i >= 0; i--) if (test(anc[i])) return anc[i]; return null; };
      const nomlar = n => { const N = new Set(); patNom(n, N); return [...N]; };
      walk.fullAncestor(ast, (n, st, anc) => {
        if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
          if (n.id) qoy(n.id.name, n.type === 'FunctionDeclaration' ? topQam(anc, QAM, true) : n);   // funksiya nomi — tashqi qamrovda (ifoda bo'lsa — o'zida)
          n.params.forEach(p => nomlar(p).forEach(x => qoy(x, n))); }
        else if (n.type === 'VariableDeclarator') { const dek = anc[anc.length - 2]; const varmi = dek && dek.kind === 'var'; nomlar(n.id).forEach(x => qoy(x, topQam(anc, varmi ? QAM : BLOK, true))); }
        else if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') { if (n.id) qoy(n.id.name, n.type === 'ClassDeclaration' ? topQam(anc, BLOK, true) : n); }
        else if (n.type === 'CatchClause') nomlar(n.param).forEach(x => qoy(x, n));
        else if (n.type === 'UnaryExpression' && n.operator === 'typeof' && n.argument.type === 'Identifier') G.add(n.argument.name);   // typeof xaritaOch==='function' — boshqa sahifa funksiyasi, himoyalangan
        else if (n.type === 'AssignmentExpression') { if (n.left.type === 'Identifier') D.add(n.left.name); else if (n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier' && /^(window|globalThis|self)$/.test(n.left.object.name) && n.left.property.type === 'Identifier') D.add(n.left.property.name); else nomlar(n.left).forEach(x => D.add(x)); }
        else if ((n.type === 'CallExpression' || n.type === 'NewExpression') && n.callee.type === 'Identifier') CH.push({ nom: n.callee.name, f: z.f, qator: b.qator + b.kod.slice(0, n.start).split('\n').length, anc: anc.slice(0, -1) });
      }); }));
    const ichida = c => c.anc.some(a => { const S = SC.get(a); return S && S.has(c.nom); });
    const yoq = {}; CH.forEach(c => { if (D.has(c.nom) || GLOBAL.has(c.nom) || G.has(c.nom) || ichida(c)) return; const k = c.f + '\t' + c.nom; (yoq[k] = yoq[k] || []).push(c.qator); });
    const K = Object.keys(yoq);
    if (!K.length) console.log('  skript ichidagi chaqiruvlar: ' + CH.length + ' ta — hammasi ta\'riflangan');
    K.forEach(k => { const [f, nom] = k.split('\t'), q = [...new Set(yoq[k])], sah = f.split('/').pop(), asosiy = /index/i.test(sah);
      console.log('  ' + (asosiy ? '✗' : '⚠') + ' ' + sah + ': «' + nom + '(…)» chaqirilgan, lekin hech qayerda ta\'riflanmagan (' + q.length + ' joy; qator ' + q.slice(0, 5).join(', ') + ') — ishlaganda «' + nom + ' is not defined» chiqadi');
      if (asosiy) yomon++; });
  } }

process.exit(yomon ? 2 : 0);
