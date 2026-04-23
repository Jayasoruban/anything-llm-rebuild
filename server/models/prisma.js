const { PrismaClient } = require("@prisma/client");

// Single shared Prisma instance — reusing it avoids exhausting DB connections.
// In dev, nodemon restarts re-import this module; globalThis keeps one client
// across reloads so we don't leak connections.
const prisma = globalThis.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;

module.exports = { prisma };
