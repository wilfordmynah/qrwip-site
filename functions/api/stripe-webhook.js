// Stripe calls this after a successful payment. We verify it really came from Stripe, then create the order.
import { createOrder } from '../_lib/orders.js';
import { sendMail, orderConfirmEmail } from '../_lib/mail.js';
const hmac = async (key, msg) => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))].map(x => x.toString(16).padStart(2, '0')).join(''); };
const same = (a, b) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const addr = d => d ? [d.line1, d.line2, [d.city, d.state, d.postal_code].filter(Boolean).join(' '), d.country].filter(Boolean).join('\n') : '';

const m0 = s => (s.metadata || {}).kind === 'custom' ? 'custom' : 'standard';

export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  const sig = Object.fromEntries((request.headers.get('stripe-signature') || '').split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k, v]));
  const t = +sig.t;
  if (!env.STRIPE_WEBHOOK_SECRET || !sig.t || !sig.v1 || Math.abs(Date.now() / 1000 - t) > 300 || !same(sig.v1, await hmac(env.STRIPE_WEBHOOK_SECRET, `${sig.t}.${raw}`)))
    return new Response('bad signature', { status: 400 });
  let ev; try { ev = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  if (ev.type !== 'checkout.session.completed' || ev.data.object.payment_status === 'unpaid') return new Response('ignored');
  const s = ev.data.object;
  if (await env.DB.prepare('SELECT id FROM orders WHERE stripe_session=?').bind(s.id).first()) return new Response('already handled');   // Stripe may resend
  const ship = s.shipping_details || s.collected_information?.shipping_details;
  const m = s.metadata || {};
  const r = await createOrder(env, { kind: m.kind, qty: m.qty, color: m.color || null, name: ship?.name || s.customer_details?.name, email: s.customer_details?.email,
    ship_to: addr(ship?.address || s.customer_details?.address), amount_cents: s.amount_total, stripe_session: s.id });
  if (r.error && !r.orderId) return new Response('order failed: ' + r.error, { status: 500 });
  try {                                                                                              // heads-up email to you (never blocks the order)
    const origin = new URL(request.url).origin, usd = '$' + ((s.amount_total || 0) / 100).toFixed(2), kind = m0(s);
    const who = ship?.name || s.customer_details?.name || 'Customer', n = r.ids ? r.ids.length : (m.qty || '?');
    const lines = [`${who} just ordered ${n} ${kind === 'custom' ? 'custom-color ' : ''}sign${n == 1 ? '' : 's'} for ${usd}.`, '',
      r.ok ? `Order #${r.orderId}  ·  signs: ${r.ids.join(', ')}` : `ORDER NEEDS ATTENTION (#${r.orderId || '?'}): ${r.error}`,
      kind === 'custom' && m.color ? `Color: ${m.color}` : '', `Email: ${s.customer_details?.email || ''}`, '', 'Ship to:', addr(ship?.address || s.customer_details?.address), '', `Open admin: ${origin}/admin`].filter((x, i, a) => x !== '' || a[i - 1] !== '');
    await sendMail(env, { to: env.CONTACT_TO || 'hello@qrwip.com', subject: `${r.ok ? 'New order' : 'Order needs attention'} #${r.orderId || '?'}: ${n} sign${n == 1 ? '' : 's'}, ${usd}`, text: lines.join('\n'), replyTo: s.customer_details?.email || undefined });
  } catch (e) {}
  if (r.ok && s.customer_details?.email) {                                                           // confirmation email (never blocks the order)
    try { const m = orderConfirmEmail({ orderId: r.orderId, name: ship?.name || s.customer_details?.name, kind: m0(s), qty: r.ids.length, color: (s.metadata || {}).color, amount: s.amount_total, ship_to: addr(ship?.address || s.customer_details?.address) }, new URL(request.url).origin);
      await sendMail(env, { to: s.customer_details.email, subject: m.subject, text: m.text, html: m.html }); } catch (e) {}
  }   // Stripe will retry
  return new Response('ok');                                                                          // (out of stock => order saved as "needs attention")
}
