import { NextResponse } from 'next/server';
import { prisma, requireOrganizer } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const s = await requireOrganizer();
    const url = new URL(req.url); const from = url.searchParams.get('from'); const to = url.searchParams.get('to');
    const start = from ? new Date(`${from}T00:00:00`) : new Date(new Date().getFullYear(),0,1);
    const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
    const where = { societyId: s.societyId, date: { gte: start, lte: end } };
    const [income, expenses] = await Promise.all([
      prisma.income.findMany({ where, orderBy:{date:'desc'}, include:{event:{select:{title:true}}} }),
      prisma.expense.findMany({ where, orderBy:{date:'desc'}, include:{event:{select:{title:true}}} })
    ]);
    const incomeTotal=income.reduce((a,x)=>a+x.amountPaise,0n), expenseTotal=expenses.reduce((a,x)=>a+x.amountPaise,0n);
    const byCategory=(rows:any[])=>Object.entries(rows.reduce((m,x)=>{const k=x.category||'Other';m[k]=(m[k]||0n)+x.amountPaise;return m},{} as Record<string,bigint>)).map(([category,amount])=>({category,amount:(amount as bigint).toString()}));
    return NextResponse.json({from:start.toISOString(),to:end.toISOString(),summary:{income:incomeTotal.toString(),expense:expenseTotal.toString(),balance:(incomeTotal-expenseTotal).toString()},income:income.map(x=>({...x,amountPaise:x.amountPaise.toString()})),expenses:expenses.map(x=>({...x,amountPaise:x.amountPaise.toString()})),incomeByCategory:byCategory(income),expenseByCategory:byCategory(expenses)});
  } catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='FORBIDDEN'?'Forbidden':'Server error'},{status:403});}
}
