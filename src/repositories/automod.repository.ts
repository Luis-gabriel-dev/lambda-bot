import { AutomodConfig } from '@prisma/client';
import { prisma } from '../core/database';

export type AutomodToggle = 'spam' | 'bigmessage' | 'invite' | 'massmention' | 'forward';
export type AutomodAllowFeature = 'bigmessage' | 'invite' | 'spam' | 'massmention' | 'forward';

type ToggleColumn = 'antiSpam' | 'antiBigMessage' | 'antiInvite' | 'antiMassMention' | 'antiForward';

function toggleColumn(feature: AutomodToggle): ToggleColumn {
  switch (feature) {
    case 'spam':
      return 'antiSpam';
    case 'bigmessage':
      return 'antiBigMessage';
    case 'invite':
      return 'antiInvite';
    case 'massmention':
      return 'antiMassMention';
    case 'forward':
      return 'antiForward';
  }
}

/** Acesso à configuração do automod, allowlists e cargos isentos. */
export const automodRepository = {
  async getConfig(guildId: string): Promise<AutomodConfig | null> {
    return prisma.automodConfig.findUnique({ where: { guildId } });
  },

  async toggle(guildId: string, feature: AutomodToggle, value: boolean): Promise<void> {
    const data = { [toggleColumn(feature)]: value };
    await prisma.automodConfig.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });
  },

  async setMaxLength(guildId: string, length: number): Promise<void> {
    await prisma.automodConfig.upsert({
      where: { guildId },
      create: { guildId, maxMessageLength: length },
      update: { maxMessageLength: length }
    });
  },

  async setMaxMentions(guildId: string, max: number): Promise<void> {
    await prisma.automodConfig.upsert({
      where: { guildId },
      create: { guildId, maxMentions: max },
      update: { maxMentions: max }
    });
  },

  // ---- Allowlist (canais/categorias liberados por módulo) ----
  async getAllowedChannels(guildId: string, feature: AutomodAllowFeature): Promise<string[]> {
    const rows = await prisma.automodAllow.findMany({ where: { guildId, feature }, select: { channelId: true } });
    return rows.map((r) => r.channelId);
  },

  async addAllow(guildId: string, feature: AutomodAllowFeature, channelId: string): Promise<void> {
    await prisma.automodAllow.upsert({
      where: { guildId_feature_channelId: { guildId, feature, channelId } },
      create: { guildId, feature, channelId },
      update: {}
    });
  },

  async removeAllow(guildId: string, feature: AutomodAllowFeature, channelId: string): Promise<boolean> {
    const result = await prisma.automodAllow.deleteMany({ where: { guildId, feature, channelId } });
    return result.count > 0;
  },

  // ---- Cargos isentos ----
  async getExemptRoleIds(guildId: string): Promise<string[]> {
    const rows = await prisma.automodExemptRole.findMany({ where: { guildId }, select: { roleId: true } });
    return rows.map((r) => r.roleId);
  },

  async addExemptRole(guildId: string, roleId: string): Promise<void> {
    await prisma.automodExemptRole.upsert({
      where: { guildId_roleId: { guildId, roleId } },
      create: { guildId, roleId },
      update: {}
    });
  },

  async removeExemptRole(guildId: string, roleId: string): Promise<boolean> {
    const result = await prisma.automodExemptRole.deleteMany({ where: { guildId, roleId } });
    return result.count > 0;
  }
};
