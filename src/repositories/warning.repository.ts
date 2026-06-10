import { Warning } from '@prisma/client';
import { prisma } from '../core/database';

/** Acesso às advertências (tabela Warning). */
export const warningRepository = {
  async add(guildId: string, userId: string, moderatorId: string, reason: string): Promise<Warning> {
    return prisma.warning.create({ data: { guildId, userId, moderatorId, reason } });
  },

  async list(guildId: string, userId: string): Promise<Warning[]> {
    return prisma.warning.findMany({ where: { guildId, userId }, orderBy: { createdAt: 'asc' } });
  },

  async count(guildId: string, userId: string): Promise<number> {
    return prisma.warning.count({ where: { guildId, userId } });
  },

  /** Remove uma advertência por id (limitada ao servidor). Retorna true se removeu. */
  async remove(id: number, guildId: string): Promise<boolean> {
    const result = await prisma.warning.deleteMany({ where: { id, guildId } });
    return result.count > 0;
  },

  /** Remove todas as advertências de um usuário. Retorna quantas foram removidas. */
  async clear(guildId: string, userId: string): Promise<number> {
    const result = await prisma.warning.deleteMany({ where: { guildId, userId } });
    return result.count;
  }
};
