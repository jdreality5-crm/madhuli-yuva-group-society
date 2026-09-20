import { NextResponse } from 'next/server';
import { requireSubAdminPermission } from '@/lib/session';

async function rest<T>(table: string, q: Record<string, string> = {}) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(q).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error('REST');
  return data as T;
}

const esc = (value: unknown) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;',
}[char]!));

const dateText = (value: unknown) => {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN');
};

export async function GET(req: Request) {
  try {
    const session = await requireSubAdminPermission('NOTICES');
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Notice id is required' }, { status: 400 });

    const rows = await rest<any[]>('Notice', {
      select: '*',
      id: `eq.${id}`,
      societyId: `eq.${session.societyId}`,
      limit: '1',
    });
    if (!rows[0]) return NextResponse.json({ error: 'Notice not found' }, { status: 404 });

    const notice = rows[0];
    const title = notice.gujaratiTitle || notice.title || 'જાહેર સૂચના';
    const content = notice.gujaratiContent || notice.content || '';
    const englishContent = notice.gujaratiContent && notice.content ? notice.content : '';
    const html = `<!doctype html>
<html lang="gu">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, "Noto Sans Gujarati", sans-serif; }
  .sheet { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto; background: url('/letterhead.jpg') center top / 100% 100% no-repeat; page-break-after: always; }
  .content { position: absolute; left: 14%; right: 14%; top: 27%; bottom: 13%; padding: 8mm 7mm; background: rgba(255,255,255,.96); overflow: hidden; }
  .date { text-align: right; color: #555; font-size: 12px; margin-bottom: 8mm; }
  h1 { margin: 0 0 7mm; text-align: center; color: #7a1f2b; font-family: "Noto Sans Gujarati", Arial, sans-serif; font-size: 22px; line-height: 1.45; }
  .body { white-space: pre-wrap; color: #222; font-family: "Noto Sans Gujarati", Arial, sans-serif; font-size: 15px; line-height: 1.9; }
  .english { margin-top: 7mm; padding-top: 5mm; border-top: 1px solid #d9c5a0; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.7; }
  .important { margin-bottom: 5mm; color: #7a1f2b; font-weight: 800; text-align: center; }
  @media print { .sheet { margin: 0; } }
</style>
</head>
<body>
  <main class="sheet">
    <section class="content">
      <div class="date">${esc(dateText(notice.date))}</div>
      ${notice.important ? '<div class="important">IMPORTANT / મહત્વપૂર્ણ</div>' : ''}
      <h1>${esc(title)}</h1>
      <div class="body">${esc(content)}</div>
      ${englishContent ? `<div class="english">${esc(englishContent)}</div>` : ''}
    </section>
  </main>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Server error' }, { status });
  }
}
