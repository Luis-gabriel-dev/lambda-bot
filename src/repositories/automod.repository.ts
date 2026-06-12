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

// Caches em memória (lidos a cada mensagem) — invalidados quando a config muda.
const configCache = new Map<string, AutomodConfig | null>();
const exemptCache = new Map<string, string[]>();
const allowCache = new Map<string, string[]>(); // chave: `${guildId}:${feature}`

/** Acesso à configuração do automod, allowlists e cargos isentos (com cache). */
export const automodRepository = {
  async getConfig(guildId: string): Promise<AutomodConfig | null> {
    if (configCache.has(guildId)) return configCache.get(guildId) ?? null;
    const config = await prisma.automodConfig.findUnique({ where: { guildId } });
    configCache.set(guildId, config);
    return config;
  },

  async toggle(guildId: string, feature: AutomodToggle, value: boolean): Promise<void> {
    const data = { [toggleColumn(feature)]: value };
    await prisma.automodConfig.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });
    configCache.delete(guildId);
  },

  async setMaxLength(guildId: string, length: number): Promise<void> {
    await prisma.automodConfig.upsert({
      where: { guildId },
      create: { guildId, maxMessageLength: length },
      update: { maxMessageLength: length }
    });
    configCache.delete(guildId);
  },

  async setMaxMentions(guildId: string, max: number): Promise<void> {
    await prisma.automodConfig.upsert({
      where: { guildId },
      create: { guildId, maxMentions: max },
      update: { maxMentions: max }
    });
    configCache.delete(guildId);
  },

  // ---- Allowlist (canais/categorias liberados por módulo) ----
  async getAllowedChannels(guildId: string, feature: AutomodAllowFeature): Promise<string[]> {
    const key = `${guildId}:${feature}`;
    const cached = allowCache.get(key);
    if (cached) return cached;
    const rows = await prisma.automodAllow.findMany({ where: { guildId, feature }, select: { channelId: true } });
    const ids = rows.map((r) => r.channelId);
    allowCache.set(key, ids);
    return ids;
  },

  async addAllow(guildId: string, feature: AutomodAllowFeature, channelId: string): Promise<void> {
    await prisma.automodAllow.upsert({
      where: { guildId_feature_channelId: { guildId, feature, channelId } },
      create: { guildId, feature, channelId },
      update: {}
    });
    allowCache.delete(`${guildId}:${feature}`);
  },

  async removeAllow(guildId: string, feature: AutomodAllowFeature, channelId: string): Promise<boolean> {
    const result = await prisma.automodAllow.deleteMany({ where: { guildId, feature, channelId } });
    allowCache.delete(`${guildId}:${feature}`);
    return result.count > 0;
  },

  // ---- Cargos isentos ----
  async getExemptRoleIds(guildId: string): Promise<string[]> {
    const cached = exemptCache.get(guildId);
    if (cached) return cached;
    const rows = await prisma.automodExemptRole.findMany({ where: { guildId }, select: { roleId: true } });
    const ids = rows.map((r) => r.roleId);
    exemptCache.set(guildId, ids);
    return ids;
  },

  async addExemptRole(guildId: string, roleId: string): Promise<void> {
    await prisma.automodExemptRole.upsert({
      where: { guildId_roleId: { guildId, roleId } },
      create: { guildId, roleId },
      update: {}
    });
    exemptCache.delete(guildId);
  },

  async removeExemptRole(guildId: string, roleId: string): Promise<boolean> {
    const result = await prisma.automodExemptRole.deleteMany({ where: { guildId, roleId } });
    exemptCache.delete(guildId);
    return result.count > 0;
  }
};
