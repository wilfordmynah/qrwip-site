// Shared order logic: used by the admin page now and by Stripe checkout next.
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
export const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';           // no 0/O/1/I look-alikes
export const LOW_STOCK = 20;

export async function stockInfo(env) {
  const std = await env.DB.prepare("SELECT COUNT(*) n, MIN(id) first FROM signs WHERE order_id IS NULL AND reserved=0 AND id GLOB '[0-9]*'").first();
  const q = await env.DB.prepare("SELECT COUNT(*) n, MAX(id) last FROM signs WHERE id GLOB 'Q[0-9]*'").first();
  const toShip = await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE status IN ('new','making','needs_attention')").first();
  return { standardInStock: std.n, nextStandard: std.first, customMade: q.n, lastCustom: q.last, ordersToShip: toShip.n, lowStock: std.n < LOW_STOCK };
}

export async function loadBatch(env, first, last) {
  const a = +first, b = +last;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 11 || b < a || b > 999999 || b - a > 5000) return { error: 'Enter a first and last number (first must be 11 or higher, up to 5,000 at a time).' };
  const stmts = [];
  for (let n = a; n <= b; n++) stmts.push(env.DB.prepare('INSERT OR IGNORE INTO signs (id) VALUES (?)').bind(String(n).padStart(4, '0')));
  for (let i = 0; i < stmts.length; i += 90) await env.DB.batch(stmts.slice(i, i + 90));
  return { ok: true, count: b - a + 1 };
}

// Creates the order, assigns sign numbers, makes the claim code. kind: 'standard' (from stock) or 'custom' (new Q numbers).
export async function createOrder(env, o) {
  const qty = Math.floor(+o.qty);
  if (!(qty >= 1 && qty <= 500)) return { error: 'Quantity must be between 1 and 500.' };
  const kind = o.kind === 'custom' ? 'custom' : 'standard';
  const color = o.color ? String(o.color).trim().toLowerCase() : null;
  if (color && !/^#[0-9a-f]{6}$/.test(color)) return { error: 'Color must look like #b8f000.' };
  if (kind === 'standard' && !o.stripe_session) { const s = await stockInfo(env); if (s.standardInStock < qty) return { error: `Only ${s.standardInStock} standard signs in stock.` }; }
  const raw = [...crypto.getRandomValues(new Uint8Array(12))].map(x => ALPHA[x % 32]).join('');
  const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  const now = Date.now();
  const ins = await env.DB.prepare(`INSERT INTO orders (claim_hash, claim_code, note, created_at, status, kind, customer_name, customer_email, ship_to, color_hex, amount_cents, stripe_session)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(await sha(raw), code, o.note || null, now, 'new', kind, o.name || null, o.email || null, o.ship_to || null, color, o.amount_cents ?? null, o.stripe_session || null).run();
  const orderId = ins.meta.last_row_id;
  if (kind === 'standard') {
    const r = await env.DB.prepare("UPDATE signs SET order_id=? WHERE id IN (SELECT id FROM signs WHERE order_id IS NULL AND reserved=0 AND id GLOB '[0-9]*' ORDER BY id LIMIT ?)").bind(orderId, qty).run();
    if (r.meta.changes < qty) { await env.DB.prepare('UPDATE signs SET order_id=NULL WHERE order_id=?').bind(orderId).run(); await env.DB.prepare("UPDATE orders SET status='needs_attention', note=COALESCE(note,'')||' [not enough stock, customer paid for '||?||']' WHERE id=?").bind(qty, orderId).run(); return { error: 'Not enough standard signs in stock.', orderId }; }
  } else {
    const st = env.DB.prepare("INSERT INTO signs (id, order_id) SELECT 'Q'||printf('%04d', COALESCE((SELECT MAX(CAST(SUBSTR(id,2) AS INTEGER)) FROM signs WHERE id GLOB 'Q[0-9]*'),0)+1), ?").bind(orderId);
    await env.DB.batch(Array.from({ length: qty }, () => st));
  }
  const ids = (await env.DB.prepare('SELECT id FROM signs WHERE order_id=? ORDER BY id').bind(orderId).all()).results.map(r => r.id);
  return { ok: true, orderId, code, ids };
}

export async function listOrders(env) {
  const r = await env.DB.prepare(`SELECT o.id, o.created_at, o.status, o.kind, o.customer_name, o.customer_email, o.ship_to, o.color_hex, o.amount_cents, o.tracking, o.shipped_at, o.note, o.claim_code,
    o.claimed_by IS NOT NULL AS claimed, (SELECT COUNT(*) FROM signs WHERE order_id=o.id) AS qty, (SELECT GROUP_CONCAT(id, ', ') FROM (SELECT id FROM signs WHERE order_id=o.id ORDER BY id)) AS signs
    FROM orders o ORDER BY o.id DESC LIMIT 200`).all();
  return r.results;
}

export async function setStatus(env, id, status, tracking) {
  if (!['new', 'making', 'shipped', 'done', 'needs_attention'].includes(status)) return false;
  const shipped = status === 'shipped';
  const r = await env.DB.prepare('UPDATE orders SET status=?, tracking=COALESCE(?,tracking), shipped_at=CASE WHEN ? THEN ? ELSE shipped_at END WHERE id=?')
    .bind(status, tracking || null, shipped ? 1 : 0, Date.now(), +id).run();   // claim code is kept so you can reprint it if a customer loses theirs
  return r.meta.changes > 0;
}

export async function listReserved(env) {
  const r = await env.DB.prepare(`SELECT s.id, s.label, s.destination, s.owner_id, (SELECT COUNT(*) FROM scans c WHERE c.sign_id=s.id) AS total
    FROM signs s WHERE s.reserved=1 ORDER BY s.id`).all();
  return r.results;
}
// Reserved signs belong to the admin, so they also show up in the admin's own account.
export async function saveReserved(env, adminId, id, label, destination) {
  const r = await env.DB.prepare('UPDATE signs SET label=?, destination=?, owner_id=?, updated_at=? WHERE id=? AND reserved=1')
    .bind(label || null, destination || null, adminId, Date.now(), String(id)).run();
  return r.meta.changes > 0;
}
