import { NextResponse } from 'next/server';
import { requireSession, prisma } from '@/lib/auth';

export async function GET() {
  try {
    const session = await requireSession();
    const [society, upcomingEvents, notices, photos] = await Promise.all([
      prisma.society.findUnique({ where: { id: session.societyId }, select: { id: true, name: true, address: true, city: true, state: true, logoUrl: true, contact: true } }),
      prisma.event.findMany({ where: { societyId: session.societyId, status: 'PUBLISHED', date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 6, select: { id: true, title: true, gujaratiTitle: true, date: true, time: true, location: true, description: true, imageUrl: true } }),
      prisma.notice.findMany({ where: { societyId: session.societyId, status: 'PUBLISHED' }, orderBy: { date: 'desc' }, take: 8, select: { id: true, title: true, gujaratiTitle: true, content: true, gujaratiContent: true, date: true, important: true, imageUrl: true } }),
      prisma.photo.findMany({ where: { societyId: session.societyId }, orderBy: { createdAt: 'desc' }, take: 12, select: { id: true, title: true, fileUrl: true, altText: true, albumName: true, eventId: true } })
    ]);
    if (session.role === 'OWNER') return NextResponse.json({ role: session.role, permissions: session.permissions, society, upcomingEvents, notices, photos });
    const [income, expense, flats, events] = await Promise.all([
      prisma.income.aggregate({ where: { societyId: session.societyId }, _sum: { amountPaise: true } }),
      prisma.expense.aggregate({ where: { societyId: session.societyId }, _sum: { amountPaise: true } }),
      prisma.flat.count({ where: { societyId: session.societyId, status: 'ACTIVE' } }),
      prisma.event.count({ where: { societyId: session.societyId } })
    ]);
    const totalIncome = income._sum.amountPaise ?? 0n;
    const totalExpense = expense._sum.amountPaise ?? 0n;
    return NextResponse.json({ role: session.role, society, upcomingEvents, notices, photos, stats: { totalIncome: totalIncome.toString(), totalExpense: totalExpense.toString(), balance: (totalIncome - totalExpense).toString(), flats, events } });
  } catch (e) {
    const status = e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Server error' }, { status });
  }
}
