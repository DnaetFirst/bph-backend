import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
const dir = path.resolve('../.local/backups'); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `pre-bajas-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: url.searchParams.get('sslmode') || 'require', PGCONNECT_TIMEOUT: '20' };
const result = spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_dump.exe', ['--format=custom', '--no-owner', '--no-acl', '--file', file], { env, encoding: 'utf8', timeout: 120000 });
if (result.status !== 0) { console.error('No se completó el respaldo:', result.stderr || result.error?.message); process.exit(1); }
const check = spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe', ['--list', file], { encoding: 'utf8' });
if (check.status !== 0 || fs.statSync(file).size < 100) throw new Error('El respaldo no pasó validación');
console.log(JSON.stringify({ archivo: file, bytes: fs.statSync(file).size, inventarioVerificado: true, host: url.hostname }));
