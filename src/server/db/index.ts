import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ponytail: Charge.voidedAt must be written as an EXPLICIT null on every create/upsert — Prisma-on-
// Mongo treats a missing key as ≠ null and the live-due reads filter `voidedAt: null`. A client
// $extends would enforce this centrally but breaks Prisma.TransactionClient typing across the
// ledger; upgrade if Prisma's extension types ever compose with TransactionClient.
