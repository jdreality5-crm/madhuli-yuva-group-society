import { PrismaClient } from 'prisma-client-js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function main() {
  const password = process.env.MASTER_ADMIN_PASSWORD;
  if (!password) throw new Error('MASTER_ADMIN_PASSWORD is required for seeding. Set the temporary password in the environment; never commit it.');
  const hash = await bcrypt.hash(password, 12);
  const society = await prisma.society.upsert({
    where: { id: 'demo-society-v2' },
    update: {},
    create: { id: 'demo-society-v2', name: 'Saranga Flat & Pramukhpark Society', city: 'Ahmedabad', state: 'Gujarat', reportFooter: 'Authorized Organizer' }
  });
  await prisma.user.upsert({
    where: { email: 'organizer@example.com' },
    update: { passwordHash: hash, societyId: society.id, role: 'MASTER_ADMIN', status: 'ACTIVE', name: 'Avnish Patel' },
    create: { email: 'organizer@example.com', passwordHash: hash, name: 'Avnish Patel', role: 'MASTER_ADMIN', societyId: society.id }
  });
  console.log('Seed completed. Master Admin: Avnish Patel / organizer@example.com');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
