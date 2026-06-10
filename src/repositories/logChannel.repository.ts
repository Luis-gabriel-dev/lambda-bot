import { prisma } from '../core/database';

/** Acesso aos canais de log por tipo/servidor (tabela LogChannel). */
export const logChannelRepository = {
  /** Define (ou troca) o canal de um tipo de log. */
  async setChannel(guildId: string, type: string, channelId: string): Promise<void> {
    await prisma.logChannel.upsert({
      where: { guildId_type: { guildId, type } },
      create: { guildId, type, channelId },
      update: { channelId }
    });
  },

  /** Remove a configuração de um tipo de log. Retorna true se algo foi removido. */
  async removeChannel(guildId: string, type: string): Promise<boolean> {
    const result = await prisma.logChannel.deleteMany({ where: { guildId, type } });
    return result.count > 0;
  },

  /** ID do canal configurado para um tipo (ou null). */
  async getChannelId(guildId: string, type: string): Promise<string | null> {
    const row = await prisma.logChannel.findUnique({ where: { guildId_type: { guildId, type } } });
    return row?.channelId ?? null;
  },

  /** Todas as configurações de log do servidor. */
  async listForGuild(guildId: string): Promise<{ type: string; channelId: string }[]> {
    return prisma.logChannel.findMany({ where: { guildId }, select: { type: true, channelId: true } });
  }
};
