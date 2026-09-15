import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma=new PrismaClient();
async function main(){
  const password=process.env.SEED_PASSWORD;
  if(!password){throw new Error('SEED_PASSWORD is required for seeding. No default password is allowed.');}
  const hash=await bcrypt.hash(password,12);
  const society=await prisma.society.upsert({where:{id:'demo-society-v2'},update:{},create:{id:'demo-society-v2',name:'Saranga Flat & Pramukhpark Society',city:'Ahmedabad',state:'Gujarat',reportFooter:'Authorized Organizer'}});
  await prisma.user.upsert({where:{email:'organizer@example.com'},update:{passwordHash:hash,societyId:society.id,role:'ORGANIZER',status:'ACTIVE'},create:{email:'organizer@example.com',passwordHash:hash,name:'Society Organizer',role:'ORGANIZER',societyId:society.id}});
  console.log('Seed completed. Organizer: organizer@example.com');
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
