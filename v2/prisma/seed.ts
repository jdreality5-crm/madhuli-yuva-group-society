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

  const password = process.env.MASTER_ADMIN_PASSWORD;
  const resetRequested = process.env.RESET_MASTER_ADMIN_PASSWORD === 'true';

  if (existing) {
    if (resetRequested) {
      if (!password) {
        throw new Error('MASTER_ADMIN_PASSWORD is required when RESET_MASTER_ADMIN_PASSWORD=true.');
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, status: 'ACTIVE', role: 'MASTER_ADMIN', societyId: society.id },
      });
      console.log('Master Admin password reset successfully. Disable RESET_MASTER_ADMIN_PASSWORD after deployment.');
    } else {
      console.log('Master Admin already exists. Seed skipped.');
    }
    return;
  }

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
