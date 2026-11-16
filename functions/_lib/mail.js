// Sends one email through Resend. Returns true/false, never throws.
export async function sendMail(env, { to, subject, text, html, replyTo }) {
  if (!to) return false;
  try {
    if (env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM || 'QRwip <login@qrwip.com>', to, subject, text, ...(html ? { html } : {}), reply_to: replyTo || 'hello@qrwip.com' }) });
      return r.ok;
    }
    if (env.DEV_LOGIN === '1') { console.log(`\n=== EMAIL to ${to}: ${subject} ===\n${text}\n`); return true; }   // local testing only
  } catch (e) {}
  return false;
}
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const F = "font-family:Inter,'Helvetica Neue',Arial,sans-serif";
const H = "font-family:Outfit,'Helvetica Neue',Arial,sans-serif";
const firstName = n => (n ? String(n).trim().split(/\s+/)[0] : '');
const money = c => '$' + (c / 100).toFixed(2);

// ---- shared on-brand layout (black header, lime stripe, white card) ----
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td><a href="${esc(href)}" style="display:inline-block;background:#b8f000;color:#000000;${F};font-size:16px;font-weight:600;text-decoration:none;padding:15px 30px;border-radius:12px">${esc(label)}</a></td></tr></table>`;
const step = (n, t) => `<tr><td style="padding:0 14px 14px 0;vertical-align:top;width:34px"><div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:#0b0d10;color:#b8f000;text-align:center;${H};font-weight:700;font-size:14px">${n}</div></td><td style="padding:3px 0 14px;${F};font-size:15px;line-height:1.5;color:#2f3238">${t}</td></tr>`;
const steps = list => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${list.map((t, i) => step(i + 1, t)).join('')}</table>`;
const h3 = t => `<div style="${H};font-size:22px;font-weight:600;letter-spacing:-.02em;color:#0b0d10;margin-bottom:14px">${t}</div>`;
const para = t => `<div style="${F};font-size:16px;line-height:1.6;color:#2f3238;margin-bottom:20px">${t}</div>`;
const small = t => `<div style="${F};font-size:13px;line-height:1.6;color:#8a8e96;margin-top:18px">${t}</div>`;

function shell({ origin, eyebrow, title, preheader, body, sign = true }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f6"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
<tr><td bgcolor="#0b0d10" style="background:#0b0d10;border-radius:20px 20px 0 0;padding:30px 32px 34px">
  <img src="${origin}/images/logo-lime.png" alt="QRwip" width="96" height="32" style="display:block;border:0;height:32px;width:auto;margin-bottom:34px">
  <div style="${F};font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#b8f000;margin-bottom:10px">${esc(eyebrow)}</div>
  <div style="${H};font-size:36px;line-height:1.05;font-weight:600;letter-spacing:-.03em;color:#ffffff">${esc(title)}</div>
</td></tr>
<tr><td bgcolor="#b8f000" style="background:#b8f000;height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:30px 32px 8px;border-radius:0 0 20px 20px">
  ${body}
  <div style="border-top:1px solid #e4e6ea;margin-top:26px;padding:20px 0 24px;${F};font-size:14px;line-height:1.6;color:#5c6068">${sign ? 'Questions? Just reply to this email and we will help.<br><b style="color:#0b0d10">The QRwip team</b>' : 'Questions? Just reply to this email.'}</div>
</td></tr>
<tr><td align="center" style="padding:20px 12px 8px;${F};font-size:12px;line-height:1.6;color:#8a8e96">QRwip · One QR code. Any destination.<br><a href="${origin}" style="color:#8a8e96">qrwip.com</a> · <a href="${origin}/privacy/" style="color:#8a8e96">Privacy</a> · <a href="${origin}/terms/" style="color:#8a8e96">Terms</a></td></tr>
</table></td></tr></table></body></html>`;
}

// ---- 1. Sign-in link ----
export const signInEmail = (link, origin) => ({
  subject: 'Your QRwip sign-in link',
  html: shell({ origin, eyebrow: 'Sign in', title: 'Your sign-in link', preheader: 'Tap to sign in to QRwip. This link works once and expires in 15 minutes.',
    body: para('Tap the button to sign in to your QRwip account. This link works <b>once</b> and expires in <b>15 minutes</b>.') + button(link, 'Sign in to QRwip') +
      small(`Button not working? Copy and paste this link into your browser:<br><a href="${esc(link)}" style="color:#5c6068;word-break:break-all">${esc(link)}</a>`) +
      small("Didn't ask to sign in? You can safely ignore this email. Nobody can get in without this link.") }),
  text: `Sign in to QRwip (works once, expires in 15 minutes):\n\n${link}\n\nDidn't ask to sign in? You can safely ignore this email.\n\nQRwip`,
});

// ---- 2. Order confirmation (sent right after payment) ----
export const orderConfirmEmail = (o, origin) => {
  const first = firstName(o.name), qty = +o.qty || 0, signs = qty === 1 ? '1 sign' : `${qty} signs`, custom = o.kind === 'custom';
  const row = (k, v) => `<tr><td style="padding:9px 0;${F};font-size:14px;color:#5c6068;vertical-align:top;width:34%">${k}</td><td style="padding:9px 0;${F};font-size:15px;color:#0b0d10;font-weight:600;vertical-align:top">${v}</td></tr>`;
  const swatch = c => `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${esc(c)};border:1px solid #dcdee3;vertical-align:-2px;margin-right:6px"></span>${esc(c.toUpperCase())}`;
  const summary = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;border-radius:14px;margin-bottom:26px"><tr><td style="padding:12px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row('Order', '#' + esc(o.orderId))}${row('Items', esc(signs) + (custom ? ' · custom color' : ' · standard'))}${custom && o.color ? row('Color', swatch(o.color)) : ''}
    ${o.amount != null ? row('Total paid', esc(money(o.amount))) : ''}${o.ship_to ? row('Shipping to', esc(o.ship_to).replace(/\n/g, '<br>')) : ''}</table></td></tr></table>`;
  return {
    subject: `Order #${o.orderId} confirmed. Thank you!`,
    html: shell({ origin, eyebrow: `Order #${o.orderId} · Confirmed`, title: `${first ? esc(first) + ', thank' : 'Thank'} you! Your order is in.`, preheader: 'We got your order and will start making your QRwip.',
      body: para('Thank you for being one of our first customers. Here is what you ordered:') + summary + h3('What happens next') +
        steps([custom ? 'We <b>make your custom-color sign</b> to order and pack it.' : 'We <b>pack your sign</b>, usually within a few business days.', "We <b>ship it</b> and email you tracking. We'll include your claim code in that email too.", 'Activate your QRwip in your account, then choose where it sends people. Change it <b>anytime</b>, no reprinting.']) +
        small('Stripe also emails you a separate receipt for your payment.') }),
    text: `Hi${first ? ' ' + first : ''},

Thank you! Your QRwip order #${o.orderId} is confirmed.

${signs}${custom ? ' (custom color' + (o.color ? ' ' + o.color.toUpperCase() : '') + ')' : ''}${o.amount != null ? '\nTotal paid: ' + money(o.amount) : ''}${o.ship_to ? '\nShipping to:\n' + o.ship_to : ''}

What happens next:
1. We ${custom ? 'make your custom-color sign to order' : 'pack your sign, usually within a few business days'}.
2. We ship it and email you tracking, plus your claim code.
3. Activate your QRwip in your account at ${origin}/account/ and choose where it sends people. You can change it anytime.

Stripe also emails you a separate receipt.

Questions? Just reply to this email.
The QRwip team`,
  };
};

// ---- 3. Shipped ----
export const shippedEmail = (o, origin) => {
  const first = firstName(o.customer_name), qty = +o.qty || 0, signs = qty === 1 ? '1 sign' : `${qty} signs`;
  const link = o.claim_code ? `${origin}/account/?code=${encodeURIComponent(o.claim_code)}` : `${origin}/account/`;
  const info = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px"><tr>
    <td style="${F};font-size:14px;color:#5c6068;padding:0 0 4px">In this order</td>${o.tracking ? `<td align="right" style="${F};font-size:14px;color:#5c6068;padding:0 0 4px">Tracking</td>` : ''}</tr>
    <tr><td style="${H};font-size:20px;font-weight:600;color:#0b0d10">${esc(signs)}${o.signs ? `<div style="${F};font-size:13px;font-weight:400;color:#5c6068;margin-top:2px">${esc(o.signs)}</div>` : ''}</td>${o.tracking ? `<td align="right" style="${F};font-size:15px;font-weight:600;color:#0b0d10">${esc(o.tracking)}</td>` : ''}</tr></table>`;
  const claim = o.claim_code ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px"><tr><td align="center" bgcolor="#f4f4f6" style="background:#f4f4f6;border-radius:14px;padding:22px 16px">
    <div style="${F};font-size:13px;color:#5c6068;margin-bottom:8px">Your claim code (also on the card in your box)</div>
    <div style="font:700 26px 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.08em;color:#0b0d10;margin-bottom:18px">${esc(o.claim_code)}</div>
    <a href="${esc(link)}" style="display:inline-block;background:#b8f000;color:#000000;${F};font-size:16px;font-weight:600;text-decoration:none;padding:15px 30px;border-radius:12px">Activate my QRwip</a></td></tr></table>` : `<div style="margin:10px 0 4px">${button(link, 'Go to my account')}</div>`;
  const html = shell({ origin, eyebrow: `Order #${o.id} · Shipped`, title: `${first ? esc(first) + ', your' : 'Your'} QRwip is on its way.`, preheader: 'Your QRwip is on its way. Here is how to start using it.',
    body: info + h3('Start using it in 3 steps') + steps(['Your box arrives with your QRwip sign and a <b>claim card</b>.', 'Activate it below, or scan the QR code on the card.', 'Choose where each sign sends people. Change it <b>anytime</b>, no reprinting.']) + claim + small('Thank you for being one of our first customers.') });
  const text = `Hi${first ? ' ' + first : ''},

Your QRwip order #${o.id} is on its way${qty ? ` (${signs})` : ''}.${o.tracking ? `\n\nTracking: ${o.tracking}` : ''}

Start using it in 3 steps:
1. Your box arrives with your QRwip sign and a claim card.
2. Activate it at ${origin}/account/ with your claim code${o.claim_code ? ` (also here, in case the card goes missing): ${o.claim_code}\n   Or open: ${link}` : '.'}
3. Choose where each sign sends people. You can change it anytime.

Questions? Just reply to this email.
The QRwip team`;
  return { subject: 'Your QRwip is on its way', text, html };
};

// ---- 4. A sign is being given to someone ----
export const transferEmail = (o, origin) => {
  const link = `${origin}/account/?code=${encodeURIComponent(o.code)}`, first = firstName(o.name);
  const html = shell({ origin, eyebrow: 'A QRwip for you', title: `${first ? esc(first) + ', a' : 'A'} QRwip sign is ready for you.`, preheader: `Claim QRwip sign ${o.signId} and choose where it sends people.`,
    body: para(`${o.fromName ? esc(o.fromName) : 'We'} would like you to have <b>QRwip sign ${esc(o.signId)}</b>. A QRwip is a QR sign whose destination <b>you</b> control. Claim it, then send people to your listing, your website, or anything else, and change it <b>anytime</b>.`) +
      (o.note ? `<div style="${F};font-size:15px;line-height:1.6;color:#2f3238;background:#f4f4f6;border-radius:12px;padding:14px 16px;margin-bottom:20px">${esc(o.note)}</div>` : '') +
      h3('Claim it in 3 steps') + steps(['Tap <b>Claim my QRwip</b> below.', 'Sign in with Google, or with a link we email you. No password needed.', 'Choose where your sign sends people, and press <b>Save</b>.']) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px"><tr><td align="center" bgcolor="#f4f4f6" style="background:#f4f4f6;border-radius:14px;padding:22px 16px">
        <div style="${F};font-size:13px;color:#5c6068;margin-bottom:8px">Your claim code</div>
        <div style="font:700 26px 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.08em;color:#0b0d10;margin-bottom:18px">${esc(o.code)}</div>
        <a href="${esc(link)}" style="display:inline-block;background:#b8f000;color:#000000;${F};font-size:16px;font-weight:600;text-decoration:none;padding:15px 30px;border-radius:12px">Claim my QRwip</a></td></tr></table>` +
      small('The sign keeps working while you decide. This link can be used once.') });
  const text = `Hi${first ? ' ' + first : ''},

${o.fromName || 'We'} would like you to have QRwip sign ${o.signId}. A QRwip is a QR sign whose destination you control: claim it, then send people anywhere and change it anytime.${o.note ? `\n\n"${o.note}"` : ''}

Claim it: ${link}
Claim code: ${o.code}

Sign in with Google or an email link, then choose where your sign sends people. The sign keeps working while you decide. This link can be used once.

Questions? Just reply to this email.
The QRwip team`;
  return { subject: `A QRwip sign is ready for you (${o.signId})`, text, html };
};
