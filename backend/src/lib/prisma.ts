import { PrismaClient } from '@prisma/client';
import '../config/env'; // ensure .env is loaded (DATABASE_URL) whatever the import order

// Single shared client for the whole app (avoids exhausting SQLite connections in dev/tests).
export const prisma = new PrismaClient();
