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
};

module.exports = { User };
