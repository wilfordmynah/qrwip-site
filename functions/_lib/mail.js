// Sends one email through Resend. Returns true/false, never throws.
export async function sendMail(env, { to, subject, text }) {
  if (!to) return false;
  try {
    if (env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM || 'QRwip <login@qrwip.com>', to, subject, text, reply_to: 'hello@qrwip.com' }) });
      return r.ok;
    }
    if (env.DEV_LOGIN === '1') { console.log(`\n=== EMAIL to ${to}: ${subject} ===\n${text}\n`); return true; }   // local testing only
  } catch (e) {}
  return false;
}
export const shippedEmail = (o, origin) => ({
  subject: 'Your QRwip order has shipped',
  text: `Hi${o.customer_name ? ' ' + o.customer_name.split(' ')[0] : ''},

Your QRwip order #${o.id} is on its way.${o.tracking ? `\n\nTracking: ${o.tracking}` : ''}

To start using your QRwip, sign in at ${origin}/account/ and enter the claim code from the card in your box${o.claim_code ? ` (it is also here, in case the card goes missing):\n\n${o.claim_code}\n\nOr open this link: ${origin}/claim?code=${o.claim_code}` : '.'}

Then choose where each sign sends people. You can change it anytime.

Questions? Just reply to this email.
QRwip`,
});
