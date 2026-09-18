import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireOrganizer } from '@/lib/auth';

const schema=z.object({eventId:z.string().optional().or(z.literal('')),type:z.enum(['INVOICE','RECEIPT','OTHER']),amountPaise:z.string().regex(/^\d+$/),vendor:z.string().max(160).optional(),category:z.string().max(100).optional(),date:z.string(),paymentMethod:z.enum(['CASH','BANK_TRANSFER','UPI','CHEQUE','OTHER']).optional(),notes:z.string().max(1000).optional(),fileUrl:z.string().url().optional().or(z.literal(''))});

export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireOrganizer();
    const {id}=await params;
    const d=schema.parse(await req.json());
    const exists=await prisma.bill.findFirst({where:{id,societyId:s.societyId}});
    if(!exists)return NextResponse.json({error:'Not found'},{status:404});
    const eventId=d.eventId||null;
    if(eventId){
      const event=await prisma.event.findFirst({where:{id:eventId,societyId:s.societyId},select:{id:true}});
      if(!event)return NextResponse.json({error:'Event not found'},{status:404});
    }
    const row=await prisma.bill.update({where:{id},data:{...d,eventId,fileUrl:d.fileUrl||null,amountPaise:BigInt(d.amountPaise),date:new Date(d.date)}});
    return NextResponse.json({...row,amountPaise:row.amountPaise.toString()});
  }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
}

export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireOrganizer();
    const {id}=await params;
    const exists=await prisma.bill.findFirst({where:{id,societyId:s.societyId}});
    if(!exists)return NextResponse.json({error:'Not found'},{status:404});
    await prisma.bill.delete({where:{id}});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'Forbidden'},{status:403});}
}
