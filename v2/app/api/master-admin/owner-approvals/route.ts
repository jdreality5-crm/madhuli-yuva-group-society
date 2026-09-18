import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireMasterAdmin } from '@/lib/auth';

const actionSchema = z.object({ id: z.string().min(1), action: z.enum(['APPROVE', 'REJECT']) });

export async function GET() {
  try {
    const session = await requireMasterAdmin();
    const users = await prisma.user.findMany({
      where: { societyId: session.societyId, role: 'OWNER', approvalStatus: 'PENDING' },
      select: { id:true,name:true,email:true,mobile:true,status:true,approvalStatus:true,emailVerified:true,flat:{select:{id:true,flatNumber:true,ownerName:true,email:true,mobile:true}},unit:{select:{id:true,label:true,floorLabel:true,residentType:true,property:{select:{name:true,type:true,propertyNumber:true,block:true}}}},createdAt:true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ users });
  } catch (e) {
    const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Master Admin access required' : 'Server error' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireMasterAdmin();
    const body = actionSchema.parse(await req.json());
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({ where:{id:body.id,societyId:session.societyId,role:'OWNER'}, select:{id:true,email:true,approvalStatus:true,emailVerified:true,unitId:true} });
      if (!user) return { kind:'NOT_FOUND' as const };
      if (user.approvalStatus !== 'PENDING') return { kind:'ALREADY_PROCESSED' as const };
      if (body.action === 'APPROVE' && !user.emailVerified) return { kind:'EMAIL_NOT_VERIFIED' as const };
      const updated = await tx.user.update({ where:{id:user.id}, data:{approvalStatus:body.action==='APPROVE'?'APPROVED':'REJECTED',status:body.action==='APPROVE'?'ACTIVE':'INACTIVE'}, select:{id:true,email:true,approvalStatus:true,status:true,emailVerified:true} });
      if (body.action === 'REJECT') {
        await tx.verificationToken.deleteMany({ where:{userId:user.id} });
        if (user.unitId) await tx.propertyUnit.updateMany({ where:{id:user.unitId,residentUserId:user.id}, data:{residentUserId:null} });
        await tx.user.update({ where:{id:user.id}, data:{unitId:null,residentType:null} });
      }
      await tx.auditLog.create({ data:{societyId:session.societyId,actorUserId:session.id,userId:session.id,action:body.action,module:'RESIDENT_APPROVAL',recordId:user.id,details:`${body.action==='APPROVE'?'Approved':'Rejected'} resident ${user.email}`} });
      return { kind:'OK' as const,user:updated };
    });
    if(result.kind==='NOT_FOUND') return NextResponse.json({error:'Resident not found.'},{status:404});
    if(result.kind==='ALREADY_PROCESSED') return NextResponse.json({error:'Resident approval request has already been processed.'},{status:409});
    if(result.kind==='EMAIL_NOT_VERIFIED') return NextResponse.json({error:'Resident must verify their email before approval.'},{status:409});
    return NextResponse.json({user:result.user});
  } catch(e){const status=e instanceof z.ZodError?400:e instanceof Error&&e.message==='FORBIDDEN'?403:500;return NextResponse.json({error:status===400?'Invalid approval request.':status===403?'Master Admin access required':'Server error'},{status});}
}
