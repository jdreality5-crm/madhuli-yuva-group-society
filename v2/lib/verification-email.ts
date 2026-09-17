const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

type EmailProvider = 'gmail' | 'resend';

function getProvider(): EmailProvider | null {
  const provider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (provider === 'gmail' || provider === 'resend') return provider;
  return null;
}

export function emailVerificationConfigured() {
  const provider = getProvider();
  if (provider === 'gmail') return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_SENDER_EMAIL);
  if (provider === 'resend') return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return false;
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeHeader(value: string) { return value.replace(/[\r\n]/g, ''); }

function buildRawMessage(from: string, to: string, subject: string, text: string, html: string) {
  const boundary = `otp_${crypto.randomUUID()}`;
  const raw = [
    `From: Madhuli Yuva Group Society <${safeHeader(from)}>`,
    `To: ${safeHeader(to)}`,
    `Subject: ${safeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '', `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit', '', text,
    '', `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit', '', html,
    '', `--${boundary}--`,
  ].join('\r\n');
  return encodeBase64Url(raw);
}

async function getGmailAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Gmail verification is not configured');
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[email-verification] Gmail token error', response.status, detail.slice(0, 500));
    throw new Error('Unable to authenticate with Gmail');
  }
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Gmail did not return an access token');
  return data.access_token;
}

async function sendWithGmail(to: string, otp: string) {
  const sender = process.env.GMAIL_SENDER_EMAIL;
  if (!sender) throw new Error('Gmail verification is not configured');
  const accessToken = await getGmailAccessToken();
  const subject = 'Your Madhuli Yuva Group email verification code';
  const text = `Your Madhuli Yuva Group verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Madhuli Yuva Group</h2><p>Your email verification code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${otp}</p><p>This code expires in <strong>10 minutes</strong> and can be used only once.</p><p>If you did not request this code, you can ignore this email.</p></div>`;
  const response = await fetch(GMAIL_SEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: buildRawMessage(sender, to, subject, text, html) }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[email-verification] Gmail send error', response.status, detail.slice(0, 500));
    throw new Error('Unable to send verification email');
  }
}

async function sendWithResend(to: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Resend verification is not configured');
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [to], subject: 'Your Madhuli Yuva Group email verification code',
      text: `Your Madhuli Yuva Group verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Madhuli Yuva Group</h2><p>Your email verification code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${otp}</p><p>This code expires in <strong>10 minutes</strong> and can be used only once.</p><p>If you did not request this code, you can ignore this email.</p></div>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[email-verification] Resend provider error', response.status, detail.slice(0, 500));
    throw new Error('Unable to send verification email');
  }
}

export async function sendVerificationOtp(to: string, otp: string) {
  const provider = getProvider();
  if (!provider || !emailVerificationConfigured()) throw new Error('Email verification is not configured');
  if (provider === 'gmail') return sendWithGmail(to, otp);
  return sendWithResend(to, otp);
}
