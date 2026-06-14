import { GuildConfig, Partnership } from '@prisma/client';
import { prisma } from '../core/database';

/** Conteúdo capturado de um pedido de parceria (último convite enviado pelo opener). */
export interface PartnershipContent {
  inviteUrl: string;
  inviteServer: string | null;
  pitchText: string;
}

/**
 * Acesso ao sistema de parcerias: configuração (canais/cargos em GuildConfig),
 * cargos autorizados (PartnerSupportRole) e os tickets abertos (Partnership).
 */
export const partnershipRepository = {
  // ---- Configuração (GuildConfig) ----
  async getConfig(guildId: string): Promise<GuildConfig | null> {
    return prisma.guildConfig.findUnique({ where: { guildId } });
  },

  async setAnnounceChannel(guildId: string, channelId: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, partnerAnnounceChannelId: channelId },
      update: { partnerAnnounceChannelId: channelId }
    });
  },

  async setNotifyRole(guildId: string, roleId: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, partnerNotifyRoleId: roleId },
      update: { partnerNotifyRoleId: roleId }
    });
  },

  async setPublicChannel(guildId: string, channelId: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, partnerPublicChannelId: channelId },
      update: { partnerPublicChannelId: channelId }
    });
  },

  async setImage(guildId: string, url: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, partnerImageUrl: url },
      update: { partnerImageUrl: url }
    });
  },

  async setCategory(guildId: string, categoryId: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, partnerCategoryId: categoryId },
      update: { partnerCategoryId: categoryId }
    });
  },

  // ---- Cargos autorizados (PartnerSupportRole) ----
  async addSupportRole(guildId: string, roleId: string): Promise<void> {
    await prisma.partnerSupportRole.upsert({
      where: { guildId_roleId: { guildId, roleId } },
      create: { guildId, roleId },
      update: {}
    });
  },

  async removeSupportRole(guildId: string, roleId: string): Promise<boolean> {
    const result = await prisma.partnerSupportRole.deleteMany({ where: { guildId, roleId } });
    return result.count > 0;
  },

  async getSupportRoleIds(guildId: string): Promise<string[]> {
    const rows = await prisma.partnerSupportRole.findMany({ where: { guildId }, select: { roleId: true } });
    return rows.map((r) => r.roleId);
  },

  // ---- Tickets de parceria (Partnership) ----
  async create(guildId: string, channelId: string, openerId: string): Promise<Partnership> {
    return prisma.partnership.create({ data: { guildId, channelId, openerId } });
  },

  async getByChannel(channelId: string): Promise<Partnership | null> {
    return prisma.partnership.findUnique({ where: { channelId } });
  },

  /** Ticket de parceria aberto de um usuário no servidor (para impedir múltiplos). */
  async getOpenByUser(guildId: string, openerId: string): Promise<Partnership | null> {
    return prisma.partnership.findFirst({ where: { guildId, openerId } });
  },

  async updateContent(channelId: string, content: PartnershipContent): Promise<void> {
    await prisma.partnership.update({
      where: { channelId },
      data: { inviteUrl: content.inviteUrl, inviteServer: content.inviteServer, pitchText: content.pitchText }
    });
  },

  async setStatus(channelId: string, status: string): Promise<void> {
    await prisma.partnership.update({ where: { channelId }, data: { status } });
  },

  async deleteByChannel(channelId: string): Promise<void> {
    await prisma.partnership.deleteMany({ where: { channelId } });
  },

  // ---- Métrica: parcerias fechadas por admin (PartnerStat) ----
  /** Soma +1 ao contador de quem fechou a parceria e devolve o total atualizado. */
  async incrementCloser(guildId: string, userId: string): Promise<number> {
    const row = await prisma.partnerStat.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, count: 1 },
      update: { count: { increment: 1 } }
    });
    return row.count;
  },

  async getCloserCount(guildId: string, userId: string): Promise<number> {
    const row = await prisma.partnerStat.findUnique({ where: { guildId_userId: { guildId, userId } } });
    return row?.count ?? 0;
  }
};
