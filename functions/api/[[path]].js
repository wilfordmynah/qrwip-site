import { sendMail, shippedEmail } from '../_lib/mail.js';
import { stockInfo, loadBatch, createOrder, listOrders, setStatus, listReserved, saveReserved } from '../_lib/orders.js';
// All /api/* routes: login, claim, list signs, update a sign.
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const rnd = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const cleanUrl = v => { v = String(v || '').trim(); if (!v) return ''; if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && v.length <= 2000 ? u.href : null; } catch { return null; } };

const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function verifyGoogle(token, env) {          // checks Google's signature + that the token is for QRwip
  const [h, p, sig] = String(token || '').split('.');
  if (!sig || !env.GOOGLE_CLIENT_ID) return null;
  const dec = x => JSON.parse(new TextDecoder().decode(b64u(x))), head = dec(h), pay = dec(p);
  if (head.alg !== 'RS256') return null;
  const keys = (await (await fetch('https://www.googleapis.com/oauth2/v3/certs', { cf: { cacheTtl: 3600 } })).json()).keys;
  const jwk = keys.find(k => k.kid === head.kid); if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(`${h}.${p}`))) return null;
  const ok = ['https://accounts.google.com', 'accounts.google.com'].includes(pay.iss) && pay.aud === env.GOOGLE_CLIENT_ID && pay.exp * 1000 > Date.now() && pay.email_verified === true && pay.email;
  return ok ? { email: String(pay.email).toLowerCase() } : null;
}

async function sendEmail(env, to, link) {
  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM || 'QRwip <login@qrwip.com>', to, subject: 'Your QRwip sign-in link', text: `Sign in to QRwip (works once, expires in 15 minutes):\n\n${link}` }) });
    return r.ok;
  }
  if (env.DEV_LOGIN === '1') { console.log(`\n=== SIGN-IN LINK for ${to} ===\n${link}\n`); return true; }   // local testing only
  return false;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url), path = url.pathname.replace(/^\/api\//, '').replace(/\/$/, ''), now = Date.now();
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
  const claim = async (userId, hash) => {            // one code activates every sign in the order
    const o = await q('SELECT id FROM orders WHERE claim_hash=? AND claimed_by IS NULL', hash).first();
    if (!o) return 0;
    const [, r] = await env.DB.batch([
      q('UPDATE orders SET claimed_by=?, claimed_at=? WHERE id=? AND claimed_by IS NULL', userId, now, o.id),
      q('UPDATE signs SET owner_id=? WHERE order_id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND claimed_by=?)', userId, o.id, o.id, userId)]);
    return r.meta.changes;
  };
  const signIn = async (email, claimHash) => {
    let u = await q('SELECT id FROM users WHERE email=?', email).first();
    if (!u) { await q('INSERT INTO users (email,created_at) VALUES (?,?)', email, now).run(); u = await q('SELECT id FROM users WHERE email=?', email).first(); }
    if (claimHash) await claim(u.id, claimHash);
    const s = rnd();
    await q('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', await sha(s), u.id, now + 30 * 864e5).run();
    return json({ ok: true }, 200, { 'set-cookie': `qrwip_session=${s}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${url.protocol === 'https:' ? '; Secure' : ''}` });
  };
  try {
    if (request.method === 'POST' && !(request.headers.get('content-type') || '').includes('application/json')) return json({ error: 'Bad request' }, 400);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    if (path === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
      let claimHash = null;
      if (body.code) {
        claimHash = await sha(norm(body.code));
        if (!await q('SELECT id FROM orders WHERE claim_hash=? AND claimed_by IS NULL', claimHash).first()) return json({ error: "That claim code isn't valid or has already been used." }, 400);
      }
      const n = await q('SELECT COUNT(*) n FROM login_tokens WHERE email=? AND created_at>?', email, now - 3600e3).first();
      if (n.n >= 5) return json({ error: 'Too many attempts. Please try again in an hour.' }, 429);
      const token = rnd();
      await q('INSERT INTO login_tokens (token_hash,email,claim_hash,created_at,expires_at) VALUES (?,?,?,?,?)', await sha(token), email, claimHash, now, now + 900e3).run();
      if (!await sendEmail(env, email, `${url.origin}/account/?token=${token}`)) return json({ error: "Email sign-in isn't available yet." }, 503);
      return json({ ok: true });
    }

    if (path === 'verify') {                          // POST (a button click, so email link-scanners can't use up the link)
      const h = await sha(String(body.token || ''));
      const t = await q('SELECT email, claim_hash FROM login_tokens WHERE token_hash=? AND expires_at>?', h, now).first();
      if (!t) return json({ error: 'This sign-in link has expired or was already used. Please request a new one.' }, 400);
      await q('DELETE FROM login_tokens WHERE token_hash=?', h).run();
      return signIn(t.email, t.claim_hash);
    }

    if (path === 'config') return json({ googleClientId: /\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID || '') ? env.GOOGLE_CLIENT_ID : null });
    if (path === 'google') {
      const g = await verifyGoogle(body.credential, env).catch(() => null);
      if (!g) return json({ error: "Google sign-in didn't work. Please try again." }, 400);
      let claimHash = null;
      if (body.code) {
        claimHash = await sha(norm(body.code));
        if (!await q('SELECT id FROM orders WHERE claim_hash=? AND claimed_by IS NULL', claimHash).first()) return json({ error: "That claim code isn't valid or has already been used." }, 400);
      }
      return signIn(g.email, claimHash);
    }

    const tok = /(?:^|;\s*)qrwip_session=([a-f0-9]+)/.exec(request.headers.get('cookie') || '');
    const user = tok && await q('SELECT u.id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', await sha(tok[1]), now).first();
    if (!user) return json({ error: 'Please sign in.' }, 401);

    if (path.startsWith('admin/')) {                  // owner-only tools; anyone else just sees "Not found"
      const admins = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
      if (!admins.includes(user.email)) return json({ error: 'Not found' }, 404);
      if (path === 'admin/summary') return json(await stockInfo(env));
      if (path === 'admin/orders') return json({ orders: await listOrders(env) });
      if (path === 'admin/batch') { const r = await loadBatch(env, body.first, body.last); return json(r, r.error ? 400 : 200); }
      if (path === 'admin/order') {
        const r = await createOrder(env, { kind: body.kind, qty: body.qty, name: String(body.name || '').slice(0, 120), email: String(body.email || '').slice(0, 254), ship_to: String(body.ship_to || '').slice(0, 500), color: body.color, note: String(body.note || '').slice(0, 300) });
        return json(r, r.error ? 400 : 200);
      }
      if (path === 'admin/reserved') return json({ signs: await listReserved(env) });
      if (path === 'admin/reserved-save') {
        const dest = cleanUrl(body.destination);
        if (dest === null) return json({ error: 'Enter a valid web address, like https://yourlisting.com' }, 400);
        return (await saveReserved(env, user.id, body.id, String(body.label || '').trim().slice(0, 80), dest)) ? json({ ok: true, destination: dest }) : json({ error: 'Sign not found.' }, 404);
      }
      if (path === 'admin/status') {
        if (!await setStatus(env, body.id, body.status, String(body.tracking || '').slice(0, 200))) return json({ error: 'Order not found.' }, 404);
        let emailed = false;
        if (body.status === 'shipped' && body.notify) {          // optional "your order shipped" email
          const o = await env.DB.prepare('SELECT id, customer_name, customer_email, tracking, claim_code FROM orders WHERE id=?').bind(+body.id).first();
          if (o && o.customer_email) { const m = shippedEmail(o, url.origin); emailed = await sendMail(env, { to: o.customer_email, subject: m.subject, text: m.text }); }
        }
        return json({ ok: true, emailed });
      }
      return json({ error: 'Not found' }, 404);
    }

    if (path === 'me') return json({ email: user.email });
    if (path === 'logout') { await q('DELETE FROM sessions WHERE token_hash=?', await sha(tok[1])).run(); return json({ ok: true }, 200, { 'set-cookie': 'qrwip_session=; Path=/; Max-Age=0' }); }
    if (path === 'signs') {
      const r = await q(`SELECT s.id, s.label, s.destination, s.archived_at,
        (SELECT COUNT(*) FROM scans c WHERE c.sign_id=s.id) AS total,
        (SELECT COUNT(*) FROM scans c WHERE c.sign_id=s.id AND c.ts>?) AS week
        FROM signs s WHERE s.owner_id=? ORDER BY s.id`, now - 7 * 864e5, user.id).all();
      return json({ signs: r.results });
    }
    if (path === 'claim') {
      const n = await claim(user.id, await sha(norm(body.code)));
      return n ? json({ ok: true, added: n }) : json({ error: "That claim code isn't valid or has already been used." }, 400);
    }
    if (path === 'archive') {           // archive/restore: keeps the number and its history, never frees it for reuse
      const r = await q('UPDATE signs SET archived_at=? WHERE id=? AND owner_id=?', body.archived ? now : null, String(body.id), user.id).run();
      return r.meta.changes ? json({ ok: true }) : json({ error: 'Sign not found.' }, 404);
    }
    if (path === 'sign') {
      const dest = cleanUrl(body.destination);
      if (dest === null) return json({ error: 'Enter a valid web address, like https://yourlisting.com' }, 400);
      const r = await q('UPDATE signs SET label=?, destination=?, updated_at=? WHERE id=? AND owner_id=?',
        String(body.label || '').trim().slice(0, 80) || null, dest || null, now, String(body.id), user.id).run();
      return r.meta.changes ? json({ ok: true, destination: dest }) : json({ error: 'Sign not found.' }, 404);
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) { return json({ error: 'Something went wrong. Please try again.' }, 500); }
}
