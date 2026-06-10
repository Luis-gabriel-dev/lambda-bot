import { prisma } from '../core/database';

/** Acesso aos cargos autorizados por comando/servidor (tabela CommandPermission). */
export const commandPermissionRepository = {
  /** Autoriza um cargo a usar um comando (idempotente). */
  async addRole(guildId: string, command: string, roleId: string): Promise<void> {
    await prisma.commandPermission.upsert({
      where: { guildId_command_roleId: { guildId, command, roleId } },
      create: { guildId, command, roleId },
      update: {}
    });
  },

  /** Remove a autorização de um cargo. Retorna true se algo foi removido. */
  async removeRole(guildId: string, command: string, roleId: string): Promise<boolean> {
    const result = await prisma.commandPermission.deleteMany({ where: { guildId, command, roleId } });
    return result.count > 0;
  },

  /** IDs dos cargos autorizados a usar um comando no servidor. */
  async getRoleIds(guildId: string, command: string): Promise<string[]> {
    const rows = await prisma.commandPermission.findMany({
      where: { guildId, command },
      select: { roleId: true }
    });
    return rows.map((r) => r.roleId);
  },

  /** Todas as configurações do servidor, ordenadas por comando. */
  async listForGuild(guildId: string): Promise<{ command: string; roleId: string }[]> {
    return prisma.commandPermission.findMany({
      where: { guildId },
      select: { command: true, roleId: true },
      orderBy: { command: 'asc' }
    });
  }
};
