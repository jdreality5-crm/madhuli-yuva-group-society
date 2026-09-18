import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireSubAdminPermission } from '@/lib/auth';

const schema = z.object({ title: z.string().trim().min(1).max(180), gujaratiTitle: z.string().max(180).optional(), date: z.coerce.date(), time: z.string().max(50).optional(), location: z.string().max(240).optional(), type: z.string().max(100).optional(), description: z.string().max(3000).optional(), imageUrl: z.string().url().optional(), status: z.enum(['DRAFT','PUBLISHED']).default('PUBLISHED'), visibility: z.string().max(30).default('OWNER') });

export async function GET() { try { const s = await requireSubAdminPermission('EVENTS'); return NextResponse.json(await prisma.event.findMany({ where: { societyId: s.societyId }, orderBy: { date: 'desc' } })); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); } }
export async function POST(req: Request) { try { const s = await requireSubAdminPermission('EVENTS'); const d = schema.parse(await req.json()); return NextResponse.json(await prisma.event.create({ data: { ...d, societyId: s.societyId } }), { status: 201 }); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); } }
