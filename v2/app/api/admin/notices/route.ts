import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireSubAdminPermission } from '@/lib/auth';

const schema = z.object({ title: z.string().trim().min(1).max(180), gujaratiTitle: z.string().max(180).optional(), content: z.string().min(1).max(10000), gujaratiContent: z.string().max(10000).optional(), date: z.coerce.date().optional(), important: z.boolean().default(false), imageUrl: z.string().url().optional(), status: z.enum(['DRAFT','PUBLISHED']).default('DRAFT') });
export async function GET() { try { const s = await requireSubAdminPermission(); return NextResponse.json(await prisma.notice.findMany({ where: { societyId: s.societyId }, orderBy: { date: 'desc' } })); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); } }
export async function POST(req: Request) { try { const s = await requireSubAdminPermission(); const d = schema.parse(await req.json()); return NextResponse.json(await prisma.notice.create({ data: { ...d, date: d.date ?? new Date(), societyId: s.societyId } }), { status: 201 }); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); } }
