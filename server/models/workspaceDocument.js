const { prisma } = require("./prisma");

const WorkspaceDocument = {
  // Save document metadata after a successful upload + embed pipeline.
  create: async ({ workspaceId, docId, title, mimeType, wordCount, chunkCount }) => {
    return prisma.workspaceDocument.create({
      data: { workspaceId, docId, title, mimeType, wordCount, chunkCount },
    });
  },

  // All documents for a workspace — shown in the workspace documents list.
  listForWorkspace: async (workspaceId) => {
    return prisma.workspaceDocument.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  },

  findByDocId: async (docId) => {
    return prisma.workspaceDocument.findUnique({ where: { docId } });
  },

  // Called when admin deletes a document. Caller must also remove from LanceDB.
  deleteByDocId: async (docId) => {
    return prisma.workspaceDocument.delete({ where: { docId } });
  },

  countForWorkspace: async (workspaceId) => {
    return prisma.workspaceDocument.count({ where: { workspaceId } });
  },
};

module.exports = { WorkspaceDocument };
