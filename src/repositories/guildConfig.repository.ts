import { GuildConfig } from '@prisma/client';
import { prisma } from '../core/database';

export type AutoRoleType = 'membro' | 'bot';

/** Acesso à configuração geral do servidor (tabela GuildConfig). */
export const guildConfigRepository = {
  async get(guildId: string): Promise<GuildConfig | null> {
    return prisma.guildConfig.findUnique({ where: { guildId } });
  },

  /** Define o cargo automático de membros ou de bots. */
  async setAutoRole(guildId: string, type: AutoRoleType, roleId: string): Promise<void> {
    const data = type === 'bot' ? { botRoleId: roleId } : { autoRoleId: roleId };
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, ...data },
      update: data
    });
  },

  /** Remove o cargo automático configurado. Retorna true se havia algo configurado. */
  async removeAutoRole(guildId: string, type: AutoRoleType): Promise<boolean> {
    const existing = await prisma.guildConfig.findUnique({ where: { guildId } });
    const current = type === 'bot' ? existing?.botRoleId : existing?.autoRoleId;
    if (!current) return false;

    const data = type === 'bot' ? { botRoleId: null } : { autoRoleId: null };
    await prisma.guildConfig.update({ where: { guildId }, data });
    return true;
  },

  /** Define (ou limpa, com null) o canal público de boas-vindas. */
  async setWelcomeChannel(guildId: string, channelId: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, welcomeChannelId: channelId },
      update: { welcomeChannelId: channelId }
    });
  },

  /** Define (ou limpa, com null) a imagem/gif fixo do embed de boas-vindas. */
  async setWelcomeImage(guildId: string, url: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, welcomeImageUrl: url },
      update: { welcomeImageUrl: url }
    });
  },

  /** Define (ou limpa) o canal de regras citado nas boas-vindas. */
  async setWelcomeRulesChannel(guildId: string, channelId: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, welcomeRulesChannelId: channelId },
      update: { welcomeRulesChannelId: channelId }
    });
  },

  /** Define (ou limpa) o canal de cor de perfil citado nas boas-vindas. */
  async setWelcomeColorChannel(guildId: string, channelId: string | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, welcomeColorChannelId: channelId },
      update: { welcomeColorChannelId: channelId }
    });
  },

  /** Define (ou limpa, com null = cor aleatória) a cor fixa do embed de boas-vindas. */
  async setWelcomeColor(guildId: string, color: number | null): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, welcomeColor: color },
      update: { welcomeColor: color }
    });
  }
};
