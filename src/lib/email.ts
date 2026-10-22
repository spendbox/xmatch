import "server-only";

/** Sends an email through Resend (resend.com). */
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = process.env.EMAIL_FROM ?? "Dashpad <no-reply@dashpad.site>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

/** Sends the same email to many people (up to 100 per request), each getting their own copy. */
export async function sendEmailBatch({ to, subject, html, text }: { to: string[]; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = process.env.EMAIL_FROM ?? "Dashpad <no-reply@dashpad.site>";
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < to.length; i += 100) {
    const chunk = to.slice(i, i + 100);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk.map((address) => ({ from, to: [address], subject, html, text }))),
      cache: "no-store",
    });
    if (res.ok) sent += chunk.length;
    else {
      failed += chunk.length;
      console.error(`Resend batch error ${res.status}: ${await res.text()}`);
    }
    if (i + 100 < to.length) await new Promise((r) => setTimeout(r, 600)); // stay under Resend's rate limit
  }
  return { sent, failed };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The password reset email, styled like Dashpad. */
export function resetEmail(link: string, name?: string | null) {
  const hi = name ? `Hi ${esc(name)},` : "Hi,";
  const html = `<!doctype html>
<html><body style="margin:0;background:#faf7f2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1828">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden">
  <tr><td style="background:#5b3fd9;padding:28px 32px;color:#ffffff">
    <div style="font-size:22px;font-weight:700;letter-spacing:-0.3px">Dashpad</div>
    <div style="font-size:14px;opacity:.8;margin-top:4px">Your world, your people.</div>
  </td></tr>
  <tr><td style="padding:32px">
    <h1 style="margin:0 0 12px;font-size:22px">Reset your password</h1>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#3a3448">${hi}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3a3448">Someone asked to reset the password for your Dashpad account. Tap the button to choose a new one. The link works for 1 hour.</p>
    <a href="${esc(link)}" style="display:inline-block;background:#5b3fd9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:14px">Choose a new password</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6e687c">If the button doesn't work, copy this link:<br><span style="word-break:break-all;color:#5b3fd9">${esc(link)}</span></p>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6e687c">Didn't ask for this? You can ignore this email. Your password won't change.</p>
  </td></tr>
</table>
<p style="font-size:12px;color:#6e687c;margin:16px 0 0">Dashpad · dashpad.site</p>
</td></tr></table>
</body></html>`;
  const text = `${hi}\n\nReset your Dashpad password here (valid for 1 hour):\n${link}\n\nDidn't ask for this? Ignore this email.`;
  return { subject: "Reset your Dashpad password", html, text };
}

/** An event email (reminders and "we're live"), styled like the reset email. */
export function eventEmail(e: { heading: string; message: string; title: string; when: string; kind: string; link: string; button?: string }) {
  const button = e.button ?? "Open the event";
  const html = `<!doctype html>
<html><body style="margin:0;background:#faf7f2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1828">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden">
  <tr><td style="background:#5b3fd9;padding:28px 32px;color:#ffffff">
    <div style="font-size:22px;font-weight:700;letter-spacing:-0.3px">Dashpad</div>
    <div style="font-size:14px;opacity:.8;margin-top:4px">Your world, your people.</div>
  </td></tr>
  <tr><td style="padding:32px">
    <h1 style="margin:0 0 12px;font-size:22px">${esc(e.heading)}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3448">${esc(e.message)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3efff;border-radius:16px;margin:0 0 24px">
      <tr><td style="padding:18px 20px">
        <div style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#5b3fd9">${esc(e.kind)}</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px">${esc(e.title)}</div>
        <div style="font-size:14px;color:#6e687c;margin-top:4px">${esc(e.when)}</div>
      </td></tr>
    </table>
    <a href="${esc(e.link)}" style="display:inline-block;background:#5b3fd9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:14px">${esc(button)}</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6e687c">If the button doesn't work, copy this link:<br><span style="word-break:break-all;color:#5b3fd9">${esc(e.link)}</span></p>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6e687c">You're getting this because you said you're going to this event.</p>
  </td></tr>
</table>
<p style="font-size:12px;color:#6e687c;margin:16px 0 0">Dashpad · dashpad.site</p>
</td></tr></table>
</body></html>`;
  const text = `${e.heading}\n\n${e.message}\n\n${e.kind}: ${e.title}\n${e.when}\n\n${button}: ${e.link}`;
  return { html, text };
}
