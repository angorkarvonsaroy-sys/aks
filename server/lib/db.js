// AKS TIZIM — baza (PostgreSQL) va kesh (Redis) ulanishlari
'use strict';
const { Pool } = require('pg');
const Redis = require('ioredis');
const env = require('./env');

const pool = new Pool(Object.assign({ max: 8, idleTimeoutMillis: 30000 }, env.db));
pool.on('error', e => console.error('pg pool xato:', e.message));

const redis = new Redis(env.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2, enableOfflineQueue: true });
redis.on('error', e => console.error('redis xato:', e.message));

module.exports = { pool, redis, q: (sql, p) => pool.query(sql, p) };
