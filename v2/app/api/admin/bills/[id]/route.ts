import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireSubAdminPermission } from '@/lib/auth';

const schema=z.object({eventId:z.string().optional().or(z.literal('')),propertyUnitId:z.string().optional().or(z.literal('')),type:z.enum(['INVOICE','RECEIPT','OTHER']),amountPaise:z.string().regex(/^\d+$/),vendor:z.string().max(160).optional(),category:z.string().max(100).optional(),date:z.string(),paymentMethod:z.enum(['CASH','BANK_TRANSFER','UPI','CHEQUE','OTHER']).optional(),notes:z.string().max(1000).optional(),fileUrl:z.string().max(500).optional().or(z.literal(''))});

function isSocietyFilePath(value:string|undefined,societyId:string){
  return !value || (value.startsWith(`${societyId}/`) && !value.includes('://') && !value.includes('\\') && !value.includes('..'));
}

export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireSubAdminPermission('BILLS');
    const {id}=await params;
    const d=schema.parse(await req.json());
    const exists=await prisma.bill.findFirst({where:{id,societyId:s.societyId},select:{id:true,paymentStatus:true}});
    if(!exists)return NextResponse.json({error:'Not found'},{status:404});
    if(exists.paymentStatus!=='UNPAID')return NextResponse.json({error:'Paid or pending bills cannot be edited'},{status:409});
    const eventId=d.eventId?.trim()||null;
    const propertyUnitId=d.propertyUnitId?.trim()||null;
    const fileUrl=d.fileUrl?.trim() || undefined;
    if(!isSocietyFilePath(fileUrl,s.societyId))return NextResponse.json({error:'Invalid document path'},{status:400});
    if(eventId){
      const event=await prisma.event.findFirst({where:{id:eventId,societyId:s.societyId},select:{id:true}});
      if(!event)return NextResponse.json({error:'Event not found'},{status:404});
    }
    if(propertyUnitId){
      const unit=await prisma.propertyUnit.findFirst({where:{id:propertyUnitId,property:{societyId:s.societyId}},select:{id:true}});
      if(!unit)return NextResponse.json({error:'Property unit not found'},{status:404});
    }
    const row=await prisma.bill.update({where:{id},data:{type:d.type,amountPaise:BigInt(d.amountPaise),vendor:d.vendor,category:d.category,date:new Date(d.date),paymentMethod:d.paymentMethod,notes:d.notes,fileUrl,eventId,propertyUnitId}});
    return NextResponse.json({...row,amountPaise:row.amountPaise.toString()});
  }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
}

export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireSubAdminPermission('BILLS');
    const {id}=await params;
    const exists=await prisma.bill.findFirst({where:{id,societyId:s.societyId},select:{id:true,paymentStatus:true}});
    if(!exists)return NextResponse.json({error:'Not found'},{status:404});
    if(exists.paymentStatus!=='UNPAID')return NextResponse.json({error:'Paid or pending bills cannot be deleted'},{status:409});
    const paymentCount=await prisma.payment.count({where:{billId:id,societyId:s.societyId}});
    if(paymentCount>0)return NextResponse.json({error:'Bills with payment history cannot be deleted'},{status:409});
    await prisma.bill.delete({where:{id}});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'Forbidden'},{status:403});}
}
