import { PrismaClient } from "@prisma/client";

// Giữ một client duy nhất qua các lần hot reload của Next.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
