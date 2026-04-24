const { prisma } = require("./prisma");

const WorkspaceChats = {
  // Chronological chat history scoped to a workspace.
  // If threadId is provided, returns only that thread's chats.
  // If threadId is null, returns chats that have NO thread (legacy / default context).
  getHistory: async (workspaceId, { limit = 100, threadId = undefined } = {}) => {
    const where = { workspaceId };
    if (threadId !== undefined) {
      // threadId = null  → fetch threadless chats (the "default" context)
      // threadId = <id>  → fetch that thread's chats
      where.threadId = threadId;
    }
    return prisma.workspaceChat.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  },

  addChat: async ({ workspaceId, userId = null, threadId = null, prompt, response }) => {
    return prisma.workspaceChat.create({
      data: { workspaceId, userId, threadId, prompt, response },
    });
  },

  // Delete all chats in a workspace (optionally scoped to a thread).
  deleteAllForWorkspace: async (workspaceId, { threadId = undefined } = {}) => {
    const where = { workspaceId };
    if (threadId !== undefined) where.threadId = threadId;
    return prisma.workspaceChat.deleteMany({ where });
  },
};

module.exports = { WorkspaceChats };
