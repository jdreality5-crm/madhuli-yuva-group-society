import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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

  const existing = await prisma.user.findUnique({
    where: { email: 'organizer@example.com' },
    select: { id: true },
  });

  if (existing) {
    console.log('Master Admin already exists. Seed skipped.');
    return;
  }

  const password = process.env.MASTER_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('MASTER_ADMIN_PASSWORD is required only for the first Master Admin seed. Set it in the deployment environment; never commit it.');
  }

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
