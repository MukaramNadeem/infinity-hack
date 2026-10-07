import { PrismaClient } from '@prisma/client';

// Single shared client for the whole app (avoids exhausting SQLite connections in dev/tests).
export const prisma = new PrismaClient();
