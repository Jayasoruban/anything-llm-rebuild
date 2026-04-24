const { prisma } = require("./prisma");
const { v4: uuid } = require("uuid");

const Thread = {
  // Create a new thread in a workspace for a user.
  create: async ({ workspaceId, userId, name = "New Thread" }) => {
    return prisma.thread.create({
      data: { workspaceId, userId, name, slug: uuid() },
    });
  },

  findBySlug: async (slug) => {
    return prisma.thread.findUnique({ where: { slug } });
  },

  // List all threads for a user in a workspace, newest first.
  listForUser: async (workspaceId, userId) => {
    return prisma.thread.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: "desc" },
    });
  },

  // Rename a thread.
  rename: async (slug, name) => {
    return prisma.thread.update({ where: { slug }, data: { name } });
  },

  // Delete thread — cascades to all chats in that thread.
  deleteBySlug: async (slug) => {
    return prisma.thread.delete({ where: { slug } });
  },
};

module.exports = { Thread };
