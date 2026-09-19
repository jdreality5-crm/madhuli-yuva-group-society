const FIREBASE_AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';

function apiKey() {
  const value = process.env.FIREBASE_WEB_API_KEY?.trim();
  if (!value) throw new Error('FIREBASE_WEB_API_KEY is not configured');
  return value;
}

export async function firebaseRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(FIREBASE_AUTH_BASE + ':' + path + '?key=' + encodeURIComponent(apiKey()), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof (data.error as { message?: unknown } | undefined)?.message === 'string'
      ? String((data.error as { message: string }).message) : 'Firebase Authentication request failed';
    const error = new Error(message);
    (error as Error & { code?: string }).code = message;
    throw error;
  }
  return data as T;
}

export type FirebaseAuthResult = { idToken: string; refreshToken: string; expiresIn: string; localId: string; email: string };
type FirebaseLookupResult = { users: Array<{ localId: string; email?: string; emailVerified?: boolean; disabled?: boolean }> };

export async function firebaseSignUp(email: string, password: string) { return firebaseRequest<FirebaseAuthResult>('signUp', { email, password, returnSecureToken: true }); }
export async function firebaseSignIn(email: string, password: string) { return firebaseRequest<FirebaseAuthResult>('signInWithPassword', { email, password, returnSecureToken: true }); }
export async function firebaseLookup(idToken: string) { const result = await firebaseRequest<FirebaseLookupResult>('lookup', { idToken }); return result.users?.[0] || null; }
export async function firebaseSendVerificationEmail(idToken: string) { return firebaseRequest<{ email: string; kind: string }>('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken }); }
export async function firebaseApplyVerificationCode(oobCode: string) { return firebaseRequest<{ localId: string; email: string; requestType: string; emailVerified?: boolean }>('update', { oobCode }); }
export async function firebaseDeleteUser(idToken: string) { return firebaseRequest<{ localId: string }>('delete', { idToken }); }
export function firebaseAuthConfigured() { return Boolean(process.env.FIREBASE_WEB_API_KEY?.trim()); }
export function isGmailAddress(email: string) { return /^[^@\s]+@gmail\.com$/i.test(email.trim()); }
export function normalizeGmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!isGmailAddress(value)) return value;
  const [local, domain] = value.split('@');
  return local.replace(/\./g, '').split('+')[0] + '@' + domain;
}
