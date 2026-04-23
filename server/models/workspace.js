const { prisma } = require("./prisma");

const DEFAULT_SLUG = "default";

const Workspace = {
  findBySlug: async (slug) => {
    return prisma.workspace.findUnique({ where: { slug } });
  },

  findById: async (id) => {
    return prisma.workspace.findUnique({ where: { id } });
  },

  list: async () => {
    return prisma.workspace.findMany({ orderBy: { createdAt: "asc" } });
  },

  // Idempotent — creates the default workspace on first boot, no-ops after.
  ensureDefault: async () => {
    return prisma.workspace.upsert({
      where: { slug: DEFAULT_SLUG },
      update: {},
      create: { name: "Default", slug: DEFAULT_SLUG },
    });
  },
};

module.exports = { Workspace, DEFAULT_SLUG };
