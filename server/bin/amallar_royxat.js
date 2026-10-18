#!/usr/bin/env node
// Serverdagi amallar ro'yxati (SQL uchun: 'a','b',...) — aks-bugun koprik shu bilan ko'chganlarni chiqarib tashlaydi
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
try { const A = require('../api/amallar'); console.log(Object.keys(A).filter(k => typeof A[k] === 'function' && /^[A-Za-z0-9_]+$/.test(k)).map(k => "'" + k + "'").join(',')); } catch (e) { }
process.exit(0);
