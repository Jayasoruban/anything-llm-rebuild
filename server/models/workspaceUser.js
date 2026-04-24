const { prisma } = require("./prisma");

const WorkspaceUser = {
  // Grant a user access to a workspace.
  add: async (userId, workspaceId) => {
    return prisma.workspaceUser.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      update: {},   // already exists — no-op
      create: { userId, workspaceId },
    });
  },

  // Remove a user's access from a workspace.
  remove: async (userId, workspaceId) => {
    return prisma.workspaceUser.deleteMany({ where: { userId, workspaceId } });
  },

  // Check if a user has access to a specific workspace.
  hasAccess: async (userId, workspaceId) => {
    const row = await prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    return !!row;
  },

  // All workspace IDs a user can access.
  workspaceIdsForUser: async (userId) => {
    const rows = await prisma.workspaceUser.findMany({ where: { userId } });
    return rows.map((r) => r.workspaceId);
  },

  // All users in a workspace (for admin workspace management).
  usersForWorkspace: async (workspaceId) => {
    return prisma.workspaceUser.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, username: true, role: true } } },
    });
  },
};

module.exports = { WorkspaceUser };
