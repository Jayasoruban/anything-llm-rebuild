const { prisma } = require("./prisma");

const User = {
  create: async ({ username, passwordHash, role = "default" }) => {
    return prisma.user.create({
      data: { username, password: passwordHash, role },
    });
  },

  findByUsername: async (username) => {
    return prisma.user.findUnique({ where: { username } });
  },

  findById: async (id) => {
    return prisma.user.findUnique({ where: { id } });
  },

  count: async () => prisma.user.count(),

  // Returns all users, newest first, without password field.
  list: async () => {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        suspended: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // Update a user's role — "admin" | "default".
  updateRole: async (id, role) => {
    return prisma.user.update({ where: { id }, data: { role } });
  },

  // Lock a user out (they can't login while suspended).
  suspend: async (id) => {
    return prisma.user.update({ where: { id }, data: { suspended: true } });
  },

  // Re-enable a suspended user.
  unsuspend: async (id) => {
    return prisma.user.update({ where: { id }, data: { suspended: false } });
  },

  deleteById: async (id) => {
    return prisma.user.delete({ where: { id } });
  },
};

module.exports = { User };
