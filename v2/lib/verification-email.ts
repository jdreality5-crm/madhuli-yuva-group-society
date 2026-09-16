const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function emailVerificationConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendVerificationOtp(to: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Email verification is not configured');

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your Madhuli Yuva Group email verification code',
      text: `Your Madhuli Yuva Group verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Madhuli Yuva Group</h2><p>Your email verification code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${otp}</p><p>This code expires in <strong>10 minutes</strong> and can be used only once.</p><p>If you did not request this code, you can ignore this email.</p></div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[email-verification] provider error', response.status, detail.slice(0, 500));
    throw new Error('Unable to send verification email');
  }
}
