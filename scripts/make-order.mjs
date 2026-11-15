#!/usr/bin/env node
// Usage: node scripts/make-order.mjs 12 34 "Lindsey Parker"   (signs #0012 to #0034, optional note)
// Creates ONE claim code for the whole order, an SQL file to load it, and a printable card.
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const [from, to, note = ''] = process.argv.slice(2);
const a = +from, b = +(to ?? from);
if (!(a > 0 && b >= a)) { console.error('Usage: node scripts/make-order.mjs <first sign #> <last sign #> ["note"]'); process.exit(1); }

const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';          // no 0/O/1/I look-alikes
const raw = [...randomBytes(12)].map(x => ALPHA[x % 32]).join('');
const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
const hash = createHash('sha256').update(raw).digest('hex'); // only the hash is stored; server must uppercase + strip dashes before hashing
const ids = Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(4, '0'));
const q = s => s.replace(/'/g, "''");
const sql = [
  `INSERT INTO orders (claim_hash, note, created_at) VALUES ('${hash}', '${q(note)}', ${Date.now()});`,
  ...ids.map(id => `INSERT INTO signs (id, order_id) VALUES ('${id}', (SELECT id FROM orders WHERE claim_hash = '${hash}'));`),
].join('\n') + '\n';

const tag = `${ids[0]}-${ids.at(-1)}`;
const url = `https://www.qrwip.com/claim?code=${code}`;
const card = `<!doctype html><meta charset=utf-8><title>Claim card ${tag}</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:24px}.c{display:flex;gap:16px;align-items:center;width:3.5in;height:2in;border:1px dashed #999;border-radius:10px;padding:.15in;box-sizing:border-box}
h1{font-size:15px;margin:0 0 4px}.k{font:700 17px ui-monospace,monospace;letter-spacing:.04em;margin:6px 0}p{margin:0;color:#555;font-size:11px}</style>
<div class=c><div id=q></div><div><h1>Activate your QRwips</h1><p>Scan, or go to qrwip.com/claim and enter:</p><div class=k>${code}</div><p>${ids.length} sign${ids.length > 1 ? 's' : ''} in this box</p></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>new QRCode(document.getElementById('q'),{text:${JSON.stringify(url)},width:110,height:110})</script>`;

mkdirSync('out', { recursive: true });
writeFileSync(`out/order-${tag}.sql`, sql);
writeFileSync(`out/card-${tag}.html`, card);
console.log(`Signs ${tag} (${ids.length})\nClaim code: ${code}\n\n1. Load it:  npx wrangler d1 execute qrwip --remote --file=out/order-${tag}.sql\n2. Print card: open out/card-${tag}.html in your browser`);
