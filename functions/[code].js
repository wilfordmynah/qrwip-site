// Handles qrwip.com/0012-style links. Anything else passes through to the normal site.
const page = (title, msg, status = 200) => new Response(
  `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title>` +
  `<body style="font:17px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center;color:#0b0d10">` +
  `<main style="max-width:420px"><h1 style="font-size:1.8rem;letter-spacing:-.03em">${title}</h1><p style="color:#5c6068">${msg}</p>` +
  `<a href="https://www.qrwip.com" style="display:inline-block;margin-top:12px;background:#b8f000;color:#000;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:12px">Learn about QRwip</a></main>`,
  { status, headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestGet(context) {
  const { params, env, request, next } = context;
  const id = params.code;
  if (!/^\d{4,6}$/.test(id)) return next();            // not a sign number
  const log = () => { try {                              // log the scan, but never let logging break the redirect
    context.waitUntil(env.DB.prepare('INSERT INTO scans (sign_id, ts, country) VALUES (?, ?, ?)')
      .bind(id, Date.now(), request.headers.get('cf-ipcountry')).run().catch(() => {}));
  } catch (e) {} };
  try {
    const row = await env.DB.prepare('SELECT destination, owner_id, archived_at FROM signs WHERE id = ?').bind(id).first();
    if (!row) return page('Sign not found', "We couldn't find this QRwip. Check the number and try again.", 404);
    if (row.archived_at) { log(); return page('This QRwip has been retired', 'Its owner is no longer using this sign.', 410); }
    if (!row.owner_id || !row.destination) return page("This QRwip isn't active yet", "Its owner hasn't set it up. Please check back soon.");
    log();
    // 302 + no-store so a changed destination takes effect immediately, never cached.
    return new Response(null, { status: 302, headers: { location: row.destination, 'cache-control': 'no-store' } });
  } catch (e) {
    return page('Temporarily unavailable', 'Please try again in a moment.', 503);
  }
}
