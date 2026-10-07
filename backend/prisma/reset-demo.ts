// Deletes all generated projects, tasks and transcripts while keeping seeded users.
// Use between transcript demo runs: `npm run db:reset-demo`.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [tasks, projects, transcripts] = await prisma.$transaction([
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.transcript.deleteMany(),
  ]);
  console.log(
    `Removed ${projects.count} projects, ${tasks.count} tasks, ${transcripts.count} transcripts. Users kept.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
