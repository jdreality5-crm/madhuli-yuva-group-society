import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireSubAdminPermission } from '@/lib/auth';

const schema = z.object({ date: z.coerce.date(), eventId: z.string().optional(), category: z.string().max(100).optional(), description: z.string().max(500).optional(), receivedFrom: z.string().max(160).optional(), amountPaise: z.coerce.bigint().positive(), paymentMethod: z.enum(['CASH','BANK_TRANSFER','UPI','CHEQUE','OTHER']), referenceNumber: z.string().max(120).optional(), notes: z.string().max(1000).optional() });

export async function GET(req: Request) {
  try { const s = await requireSubAdminPermission(); const url = new URL(req.url); const rows = await prisma.income.findMany({ where: { societyId: s.societyId, category: url.searchParams.get('category') || undefined }, orderBy: { date: 'desc' }, include: { event: { select: { id: true, title: true } } } }); return NextResponse.json(rows.map(x => ({ ...x, amountPaise: x.amountPaise.toString() }))); }
  catch (e) { return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Server error' }, { status: 403 }); }
}

export async function POST(req: Request) {
  try {
    const s = await requireSubAdminPermission();
    const d = schema.parse(await req.json());
    const eventId = d.eventId?.trim() || null;
    if (eventId) {
      const event = await prisma.event.findFirst({ where: { id: eventId, societyId: s.societyId }, select: { id: true } });
      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const row = await prisma.income.create({ data: { ...d, eventId, societyId: s.societyId, createdById: s.id } });
    return NextResponse.json({ ...row, amountPaise: row.amountPaise.toString() }, { status: 201 });
  }
  catch (e) { return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Invalid request' }, { status: 403 }); }
}
