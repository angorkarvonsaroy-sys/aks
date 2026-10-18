// AKS TIZIM — HTML → PDF serverda (WeasyPrint; deploy.sh o'rnatadi: weasyprint, fonts-liberation).
// Eski tizim: Utilities.newBlob(html, 'text/html').getAs('application/pdf') — Google'ning o'zgartirgichi. HTML matni o'sha-o'sha.
'use strict';
const { spawn, execFile } = require('child_process');

let borKesh = null;
function bor() {
  if (borKesh !== null) return Promise.resolve(borKesh);
  return new Promise(res => execFile('weasyprint', ['--version'], { timeout: 15000 }, e => { borKesh = !e; setTimeout(() => { borKesh = null; }, 600000); res(borKesh); }));
}

// css: qo'shimcha qoidalar (masalan '@page{size:A4;margin:10mm 0}') — HTML'ning <style> boshiga qo'shiladi
function yasa(html, css) {
  if (css) html = html.replace('<style>', '<style>' + css);
  return new Promise((res, rej) => {
    const p = spawn('weasyprint', ['--quiet', '-e', 'utf-8', '-', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chiq = [], xato = [];
    const t = setTimeout(() => { p.kill('SIGKILL'); rej(new Error('PDF yasash 60 soniyadan oshdi')); }, 60000);
    p.stdout.on('data', d => chiq.push(d)); p.stderr.on('data', d => xato.push(d));
    p.on('error', e => { clearTimeout(t); rej(e); });
    p.on('close', kod => { clearTimeout(t); const b = Buffer.concat(chiq);
      if (kod === 0 && b.length > 100 && b.slice(0, 5).toString() === '%PDF-') res(b);
      else rej(new Error('PDF yasalmadi (' + kod + '): ' + Buffer.concat(xato).toString().slice(-300))); });
    p.stdin.on('error', () => {});
    p.stdin.end(html, 'utf8');
  });
}

module.exports = { bor, yasa };
