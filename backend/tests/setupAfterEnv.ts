import { prisma } from '../src/lib/prisma';
import { setAiProvider } from '../src/ai';

afterEach(() => {
  setAiProvider(null); // undo any provider a test injected
});

afterAll(async () => {
  await prisma.$disconnect();
});
