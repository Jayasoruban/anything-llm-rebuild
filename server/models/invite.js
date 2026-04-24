const { prisma } = require("./prisma");
const { v4: uuid } = require("uuid");

const Invite = {
  // Admin creates an invite. Returns the token to share in a URL.
  create: async (createdById) => {
    const token = uuid();
    const invite = await prisma.invite.create({
      data: { token, createdById },
    });
    return invite;
  },

  // Find an invite by its token (used during registration to validate the link).
  findByToken: async (token) => {
    return prisma.invite.findUnique({ where: { token } });
  },

  // Mark invite as used and record who claimed it.
  markUsed: async (id, claimedById) => {
    return prisma.invite.update({
      where: { id },
      data: { used: true, claimedById },
    });
  },

  // List all invites (for admin UI).
  list: async () => {
    return prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { username: true } },
        claimedBy: { select: { username: true } },
      },
    });
  },

  deleteById: async (id) => {
    return prisma.invite.delete({ where: { id } });
  },
};

module.exports = { Invite };
