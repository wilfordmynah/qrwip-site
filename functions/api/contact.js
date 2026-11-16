// POST /api/contact  -> saves the message (so it is never lost) and emails it to hello@qrwip.com.
import { sendMail } from '../_lib/mail.js';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const clip = (v, n) => String(v || '').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json().catch(() => ({}));
    if (b.website) return json({ ok: true });                                       // hidden field: bots fill it, people don't
    const name = clip(`${b.first || ''} ${b.last || ''}`, 120), email = clip(b.email, 254).toLowerCase();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Please enter your name and a valid email address.' }, 400);
    const now = Date.now();
    const recent = await env.DB.prepare('SELECT COUNT(*) n FROM contact_messages WHERE email=? AND created_at>?').bind(email, now - 3600e3).first();
    const all = await env.DB.prepare('SELECT COUNT(*) n FROM contact_messages WHERE created_at>?').bind(now - 3600e3).first();
    if (recent.n >= 3 || all.n >= 40) return json({ error: 'Too many messages right now. Please try again later or email hello@qrwip.com.' }, 429);
    const m = { company: clip(b.company, 120), topic: clip(b.topic, 80), message: clip(b.msg, 3000) };
    const ins = await env.DB.prepare('INSERT INTO contact_messages (created_at,name,email,company,topic,message) VALUES (?,?,?,?,?,?)').bind(now, name, email, m.company, m.topic, m.message).run();
    const sent = await sendMail(env, { to: env.CONTACT_TO || 'hello@qrwip.com', replyTo: email, subject: `QRwip contact: ${m.topic || 'message'} (${name})`,
      text: `From: ${name} <${email}>\nCompany: ${m.company || '-'}\nTopic: ${m.topic || '-'}\n\n${m.message || '(no message)'}` });
    if (sent) await env.DB.prepare('UPDATE contact_messages SET emailed=1 WHERE id=?').bind(ins.meta.last_row_id).run();
    return json({ ok: true });
  } catch (e) { return json({ error: 'Something went wrong. Please email hello@qrwip.com.' }, 500); }
}
