// Seeds the ten demo users. Idempotent: upserts by unique email, so re-running
// never duplicates users (it refreshes their profile and password hash instead).

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEMO_PASSWORD, DEMO_USERS } from './demoUsers';

const prisma = new PrismaClient();

export async function seedDemoUsers(client: PrismaClient = prisma): Promise<number> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of DEMO_USERS) {
    const data = {
      code: u.code,
      name: u.name,
      role: u.role,
      specialization: u.specialization,
      skills: JSON.stringify(u.skills),
      passwordHash,
    };
    await client.user.upsert({
      where: { email: u.email },
      update: data,
      create: { ...data, email: u.email },
    });
  }
  return DEMO_USERS.length;
}

if (require.main === module) {
  seedDemoUsers()
    .then((count) => console.log(`Seeded ${count} demo users (password: ${DEMO_PASSWORD}).`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
