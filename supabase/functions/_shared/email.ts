// Sends the license key to the customer with Resend (https://resend.com).
// Needs two secrets: RESEND_API_KEY and MAIL_FROM (e.g. "ConvertFlow <support@convertflow.cc>").
// If they are not set, emailing is skipped and everything else keeps working.
const SUPPORT_EMAIL = 'support@convertflow.cc';
// The logo must be on the internet (email apps can't read files from your PC).
// It is the logo.png in your Cloudflare site folder. Change this address if your site moves.
const LOGO_URL = 'https://convertflow.wilzoners.workers.dev/logo.png';

export async function sendLicenseEmail(to: string, licenseKey: string, sessionId: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!apiKey || !from || !to) return;

  const text = [
    'Thank you for buying ConvertFlow!',
    '',
    'Your license key:',
    licenseKey,
    '',
    'To activate: open ConvertFlow, paste the key into the activation screen and click Activate.',
    'One key works on up to 3 installations.',
    '',
    'Keep this email somewhere safe. If you ever lose your key, reply to this email or write to ' + SUPPORT_EMAIL + '.',
    '',
    '- ConvertFlow',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#0a0a0a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ConvertFlow license key is inside.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;border-radius:20px;overflow:hidden;background:#18181b;border:1px solid #3f3f46;">

          <!-- Header with logo -->
          <tr>
            <td style="background:#000000;border-bottom:4px solid #facc15;padding:20px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    <img src="${LOGO_URL}" width="48" height="48" alt="ConvertFlow" style="display:block;border:0;border-radius:24px;">
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:0.5px;color:#facc15;">ConvertFlow</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;">
              <h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;color:#ffffff;">Thank you for your purchase!</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa;">Your payment went through. Here is your license key:</p>

              <!-- Key box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#000000;border:2px solid #facc15;border-radius:14px;padding:20px 16px;">
                    <div style="font-family:Consolas,'Courier New',monospace;font-size:20px;font-weight:700;letter-spacing:1.5px;color:#facc15;word-break:break-all;">${licenseKey}</div>
                  </td>
                </tr>
              </table>

              <!-- How to activate -->
              <h2 style="margin:32px 0 12px;font-size:16px;color:#facc15;">How to activate</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.6;color:#d4d4d8;">
                <tr><td style="padding:0 12px 8px 0;vertical-align:top;color:#facc15;font-weight:700;">1.</td><td style="padding-bottom:8px;">Open ConvertFlow.</td></tr>
                <tr><td style="padding:0 12px 8px 0;vertical-align:top;color:#facc15;font-weight:700;">2.</td><td style="padding-bottom:8px;">Paste the key into the activation screen.</td></tr>
                <tr><td style="padding:0 12px 0 0;vertical-align:top;color:#facc15;font-weight:700;">3.</td><td>Click <strong style="color:#ffffff;">Activate</strong>. One key works on up to 3 installations.</td></tr>
              </table>

              <!-- Keep safe -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#27272a;border-left:4px solid #facc15;border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;color:#d4d4d8;">
                    <strong style="color:#ffffff;">Keep this email somewhere safe.</strong>
                    If you ever lose your key, reply to this email or write to
                    <a href="mailto:${SUPPORT_EMAIL}" style="color:#facc15;">${SUPPORT_EMAIL}</a>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid #3f3f46;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#71717a;">
              You received this email because you bought ConvertFlow. Please don't share your license key.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Stripe may deliver the same event twice; this stops the customer getting two emails.
      'Idempotency-Key': `license-${sessionId}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: SUPPORT_EMAIL,
      subject: 'Your ConvertFlow license key',
      text,
      html,
    }),
  });
  if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
}
