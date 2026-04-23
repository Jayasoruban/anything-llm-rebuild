const { prisma } = require("./prisma");

const WorkspaceChats = {
  // Full chronological history for a workspace.
  getHistory: async (workspaceId, { limit = 100 } = {}) => {
    return prisma.workspaceChat.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  },

  addChat: async ({ workspaceId, userId = null, prompt, response }) => {
    return prisma.workspaceChat.create({
      data: { workspaceId, userId, prompt, response },
    });
  },

  deleteAllForWorkspace: async (workspaceId) => {
    return prisma.workspaceChat.deleteMany({ where: { workspaceId } });
  },
};

module.exports = { WorkspaceChats };
