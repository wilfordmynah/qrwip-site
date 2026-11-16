// POST /api/checkout  { qty, kind: 'standard'|'custom', color } -> { url } (Stripe-hosted payment page)
import { quote } from '../_lib/pricing.js';
import { stockInfo } from '../_lib/orders.js';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  try {
    if (!env.STRIPE_SECRET_KEY) return json({ error: "Checkout isn't available yet." }, 503);
    const b = await request.json().catch(() => ({}));
    const kind = b.kind === 'custom' ? 'custom' : 'standard';
    const color = kind === 'custom' ? String(b.color || '').trim().toLowerCase() : '';
    if (kind === 'custom' && !/^#[0-9a-f]{6}$/.test(color)) return json({ error: 'Please choose a valid color.' }, 400);
    const q = quote(b.qty, kind);
    if (!q) return json({ error: 'Please choose between 1 and 100 signs.' }, 400);
    if (kind === 'standard') { const s = await stockInfo(env); if (s.standardInStock < q.qty) return json({ error: s.standardInStock ? `Only ${s.standardInStock} standard signs are available right now.` : 'Standard signs are temporarily sold out.' }, 409); }
    const origin = new URL(request.url).origin;
    const f = new URLSearchParams({
      mode: 'payment', success_url: `${origin}/order/thanks/?s={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/order/`,
      'line_items[0][quantity]': String(q.qty), 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(q.unit),
      'line_items[0][price_data][product_data][name]': kind === 'custom' ? `QRwip sign, custom color ${color.toUpperCase()}` : 'QRwip sign',
      'line_items[0][price_data][product_data][description]': 'Reusable QR sign. Change where it sends people anytime.',
      'shipping_address_collection[allowed_countries][0]': 'US',
      'shipping_options[0][shipping_rate_data][type]': 'fixed_amount', 'shipping_options[0][shipping_rate_data][display_name]': q.shipping ? 'Standard shipping' : 'Free shipping',
      'shipping_options[0][shipping_rate_data][fixed_amount][amount]': String(q.shipping), 'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'usd',
      'metadata[kind]': kind, 'metadata[qty]': String(q.qty), 'metadata[color]': color,
    });
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' }, body: f });
    const s = await r.json();
    return r.ok && s.url ? json({ url: s.url }) : json({ error: "Couldn't start checkout. Please try again." }, 502);
  } catch (e) { return json({ error: 'Something went wrong. Please try again.' }, 500); }
}
