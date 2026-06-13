import { AutomodConfig } from '@prisma/client';
import { prisma } from '../core/database';

export type AutomodToggle = 'spam' | 'bigmessage' | 'invite' | 'massmention' | 'forward' | 'link' | 'gif' | 'raid';
export type AutomodAllowFeature = 'bigmessage' | 'invite' | 'spam' | 'massmention' | 'forward' | 'link' | 'gif';

type ToggleColumn =
  | 'antiSpam'
  | 'antiBigMessage'
  | 'antiInvite'
  | 'antiMassMention'
  | 'antiForward'
  | 'antiLink'
  | 'antiGif'
  | 'antiRaid';

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
    case 'link':
      return 'antiLink';
    case 'gif':
      return 'antiGif';
    case 'raid':
      return 'antiRaid';
  }
}

// Caches em memória (lidos a cada mensagem) — invalidados quando a config muda.
const configCache = new Map<string, AutomodConfig | null>();
const exemptCache = new Map<string, string[]>();
const allowCache = new Map<string, string[]>(); // chave: `${guildId}:${feature}`
const linkWhitelistCache = new Map<string, string[]>();
const linkBlacklistCache = new Map<string, string[]>();
const gifRoleCache = new Map<string, string[]>();
const linkRoleCache = new Map<string, Map<string, string[]>>(); // guild → (roleId → domínios; "*" = todos)
const domainChannelCache = new Map<string, Map<string, string[]>>(); // guild → (domínio → canais permitidos)

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

  /** Modo do anti-link: "whitelist" (bloqueia tudo, libera lista) ou "blacklist" (libera tudo, bloqueia lista). */
  async setLinkMode(guildId: string, mode: 'whitelist' | 'blacklist'): Promise<void> {
    await prisma.automodConfig.upsert({
      where: { guildId },
      create: { guildId, linkMode: mode },
      update: { linkMode: mode }
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
  },

  // ---- Whitelist de links ----
  async getLinkWhitelist(guildId: string): Promise<string[]> {
    const cached = linkWhitelistCache.get(guildId);
    if (cached) return cached;
    const rows = await prisma.automodLinkWhitelist.findMany({ where: { guildId }, select: { domain: true } });
    const domains = rows.map((r) => r.domain);
    linkWhitelistCache.set(guildId, domains);
    return domains;
  },

  /** Adiciona um domínio à whitelist. Retorna false se já existia. */
  async addLinkDomain(guildId: string, domain: string): Promise<boolean> {
    try {
      await prisma.automodLinkWhitelist.create({ data: { guildId, domain } });
      linkWhitelistCache.delete(guildId);
      return true;
    } catch {
      return false; // violação de unicidade
    }
  },

  async removeLinkDomain(guildId: string, domain: string): Promise<boolean> {
    const result = await prisma.automodLinkWhitelist.deleteMany({ where: { guildId, domain } });
    await prisma.automodLinkChannel.deleteMany({ where: { guildId, domain } }); // limpa restrições de canal junto
    linkWhitelistCache.delete(guildId);
    domainChannelCache.delete(guildId);
    return result.count > 0;
  },

  // ---- Blacklist de links (modo blacklist) ----
  async getLinkBlacklist(guildId: string): Promise<string[]> {
    const cached = linkBlacklistCache.get(guildId);
    if (cached) return cached;
    const rows = await prisma.automodLinkBlacklist.findMany({ where: { guildId }, select: { domain: true } });
    const domains = rows.map((r) => r.domain);
    linkBlacklistCache.set(guildId, domains);
    return domains;
  },

  /** Bloqueia um domínio (modo blacklist). Retorna false se já existia. */
  async addBlockedDomain(guildId: string, domain: string): Promise<boolean> {
    try {
      await prisma.automodLinkBlacklist.create({ data: { guildId, domain } });
      linkBlacklistCache.delete(guildId);
      return true;
    } catch {
      return false;
    }
  },

  async removeBlockedDomain(guildId: string, domain: string): Promise<boolean> {
    const result = await prisma.automodLinkBlacklist.deleteMany({ where: { guildId, domain } });
    linkBlacklistCache.delete(guildId);
    return result.count > 0;
  },

  // ---- Restrição de domínio a canais/categorias ----
  /** Mapa domínio → canais onde é permitido (vazio/ausente = todos os canais). */
  async getDomainChannelMap(guildId: string): Promise<Map<string, string[]>> {
    const cached = domainChannelCache.get(guildId);
    if (cached) return cached;
    const rows = await prisma.automodLinkChannel.findMany({ where: { guildId }, select: { domain: true, channelId: true } });
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.domain) ?? [];
      list.push(row.channelId);
      map.set(row.domain, list);
    }
    domainChannelCache.set(guildId, map);
    return map;
  },

  async getDomainChannels(guildId: string, domain: string): Promise<string[]> {
    return (await this.getDomainChannelMap(guildId)).get(domain) ?? [];
  },

  /** Restringe um domínio a um canal/categoria (garante o domínio na whitelist). Retorna false se já existia. */
  async addDomainChannel(guildId: string, domain: string, channelId: string): Promise<boolean> {
    await this.addLinkDomain(guildId, domain);
    try {
      await prisma.automodLinkChannel.create({ data: { guildId, domain, channelId } });
      domainChannelCache.delete(guildId);
      return true;
    } catch {
      return false;
    }
  },

  async removeDomainChannel(guildId: string, domain: string, channelId: string): Promise<boolean> {
    const result = await prisma.automodLinkChannel.deleteMany({ where: { guildId, domain, channelId } });
    domainChannelCache.delete(guildId);
    return result.count > 0;
  },

  // ---- Cargos liberados para GIFs ----
  async getGifRoleIds(guildId: string): Promise<string[]> {
    const cached = gifRoleCache.get(guildId);
    if (cached) return cached;
    const rows = await prisma.automodGifRole.findMany({ where: { guildId }, select: { roleId: true } });
    const ids = rows.map((r) => r.roleId);
    gifRoleCache.set(guildId, ids);
    return ids;
  },

  /** Libera um cargo para enviar GIFs. Retorna false se já estava liberado. */
  async addGifRole(guildId: string, roleId: string): Promise<boolean> {
    try {
      await prisma.automodGifRole.create({ data: { guildId, roleId } });
      gifRoleCache.delete(guildId);
      return true;
    } catch {
      return false;
    }
  },

  async removeGifRole(guildId: string, roleId: string): Promise<boolean> {
    const result = await prisma.automodGifRole.deleteMany({ where: { guildId, roleId } });
    gifRoleCache.delete(guildId);
    return result.count > 0;
  },

  // ---- Liberação de links por cargo ----
  /** Mapa cargo → domínios liberados ("*" = todos os links). */
  async getLinkRoles(guildId: string): Promise<Map<string, string[]>> {
    const cached = linkRoleCache.get(guildId);
    if (cached) return cached;
    const rows = await prisma.automodLinkRole.findMany({ where: { guildId }, select: { roleId: true, domain: true } });
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.roleId) ?? [];
      list.push(row.domain);
      map.set(row.roleId, list);
    }
    linkRoleCache.set(guildId, map);
    return map;
  },

  /** Domínios liberados de um cargo. */
  async getRoleLinkDomains(guildId: string, roleId: string): Promise<string[]> {
    return (await this.getLinkRoles(guildId)).get(roleId) ?? [];
  },

  /** Libera um domínio (ou "*") para um cargo. Retorna false se já existia. */
  async addRoleLink(guildId: string, roleId: string, domain: string): Promise<boolean> {
    try {
      await prisma.automodLinkRole.create({ data: { guildId, roleId, domain } });
      linkRoleCache.delete(guildId);
      return true;
    } catch {
      return false;
    }
  },

  async removeRoleLink(guildId: string, roleId: string, domain: string): Promise<boolean> {
    const result = await prisma.automodLinkRole.deleteMany({ where: { guildId, roleId, domain } });
    linkRoleCache.delete(guildId);
    return result.count > 0;
  },

  /** Remove todas as liberações de link de um cargo. Retorna quantas removeu. */
  async clearRoleLinks(guildId: string, roleId: string): Promise<number> {
    const result = await prisma.automodLinkRole.deleteMany({ where: { guildId, roleId } });
    linkRoleCache.delete(guildId);
    return result.count;
  }
};
