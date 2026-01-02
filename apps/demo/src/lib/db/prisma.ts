// Prisma Client Singleton
// Prevents multiple instances in development (hot reload)
//
// NOTE: In local environments where Prisma Client cannot be generated
// (e.g., network restrictions), the database features will fail gracefully.
// In production (Vercel), Prisma Client is generated automatically during build.

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
let PrismaClient: any;

try {
  // Dynamic require to handle missing Prisma Client
  const prismaModule = require("@prisma/client");
  PrismaClient = prismaModule.PrismaClient;
} catch {
  // Prisma Client not available - create mock
  PrismaClient = class {
    constructor() {
      console.warn("[DB] Prisma Client not available");
    }
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log errors in production for performance
    log: ["error"],
  });

// Cache in global to prevent multiple instances during hot reload
if (typeof window === "undefined") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
