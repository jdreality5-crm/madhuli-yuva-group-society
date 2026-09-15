import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.MASTER_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('MASTER_ADMIN_PASSWORD is required for seeding. Set the temporary password in the environment; never commit it.');
  }

  const society = await prisma.society.upsert({
    where: { id: 'demo-society-v2' },
    update: {},
    create: {
      id: 'demo-society-v2',
      name: 'Saranga Flat & Pramukhpark Society',
      city: 'Ahmedabad',
      state: 'Gujarat',
      reportFooter: 'Authorized Organizer',
    },
  });

  const existing = await prisma.user.findUnique({ where: { email: 'organizer@example.com' } });

  if (!existing) {
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email: 'organizer@example.com',
        passwordHash: hash,
        name: 'Avnish Patel',
        role: 'MASTER_ADMIN',
        status: 'ACTIVE',
        societyId: society.id,
      },
    });
    console.log('Seed completed. Master Admin created: Avnish Patel / organizer@example.com');
  } else {
    console.log('Seed skipped: Master Admin already exists. Existing password was preserved.');
  }
}

main()
  .catch((error) => {
    console.error('[db/seed] failed', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
