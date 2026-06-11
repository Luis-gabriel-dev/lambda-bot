import { prisma } from '../core/database';

/** Configuração do sistema de tickets: cargos de suporte e categoria dos canais. */
export const ticketConfigRepository = {
  async addSupportRole(guildId: string, roleId: string): Promise<void> {
    await prisma.ticketSupportRole.upsert({
      where: { guildId_roleId: { guildId, roleId } },
      create: { guildId, roleId },
      update: {}
    });
  },

  async removeSupportRole(guildId: string, roleId: string): Promise<boolean> {
    const result = await prisma.ticketSupportRole.deleteMany({ where: { guildId, roleId } });
    return result.count > 0;
  },

  async getSupportRoleIds(guildId: string): Promise<string[]> {
    const rows = await prisma.ticketSupportRole.findMany({ where: { guildId }, select: { roleId: true } });
    return rows.map((r) => r.roleId);
  },

  async setCategory(guildId: string, categoryId: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, ticketCategoryId: categoryId },
      update: { ticketCategoryId: categoryId }
    });
  },

  async getCategory(guildId: string): Promise<string | null> {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    return config?.ticketCategoryId ?? null;
  }
};
