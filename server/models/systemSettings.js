const { prisma } = require("./prisma");

const SETUP_COMPLETE_KEY = "has_setup_completed";

const SystemSettings = {
  get: async (label) => {
    const row = await prisma.systemSettings.findUnique({ where: { label } });
    return row?.value ?? null;
  },

  set: async (label, value) => {
    return prisma.systemSettings.upsert({
      where: { label },
      update: { value },
      create: { label, value },
    });
  },

  isSetupComplete: async () => {
    return (await SystemSettings.get(SETUP_COMPLETE_KEY)) === "true";
  },

  markSetupComplete: async () => {
    return SystemSettings.set(SETUP_COMPLETE_KEY, "true");
  },
};

module.exports = { SystemSettings, SETUP_COMPLETE_KEY };
