import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireOrganizer } from '@/lib/auth';

const schema = z.object({eventId:z.string().optional(),type:z.enum(['INVOICE','RECEIPT','OTHER']),amountPaise:z.string().regex(/^\d+$/),vendor:z.string().max(160).optional(),category:z.string().max(100).optional(),date:z.string(),paymentMethod:z.enum(['CASH','BANK_TRANSFER','UPI','CHEQUE','OTHER']).optional(),notes:z.string().max(1000).optional(),fileUrl:z.string().url().optional()});

export async function GET(){try{const s=await requireOrganizer();const rows=await prisma.bill.findMany({where:{societyId:s.societyId},orderBy:{date:'desc'},include:{event:{select:{title:true}}}});return NextResponse.json(rows.map(x=>({...x,amountPaise:x.amountPaise.toString()})));}catch(e){return NextResponse.json({error:'Forbidden'},{status:403});}}

export async function POST(req:Request){try{const s=await requireOrganizer();const d=schema.parse(await req.json());const eventId=d.eventId?.trim()||null;if(eventId){const event=await prisma.event.findFirst({where:{id:eventId,societyId:s.societyId},select:{id:true}});if(!event)return NextResponse.json({error:'Event not found'},{status:404});}const row=await prisma.bill.create({data:{...d,societyId:s.societyId,amountPaise:BigInt(d.amountPaise),date:new Date(d.date),eventId}});return NextResponse.json({...row,amountPaise:row.amountPaise.toString()},{status:201});}catch(e){return NextResponse.json({error:'Invalid request'},{status:400});}}
