// Helpers da API do Discord usados no servidor (nunca no cliente).

const ADMINISTRATOR = BigInt(0x8); // permissão de administrador

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

/** Versão enxuta guardada na sessão (só o necessário pro dashboard). */
export interface AdminGuild {
  id: string;
  name: string;
  icon: string | null;
}

/** Servidores do usuário logado (via token de acesso do OAuth). Use só no login. */
export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as DiscordGuild[];
}

/** O usuário é dono ou administrador desse servidor? */
export function isGuildAdmin(guild: DiscordGuild): boolean {
  return guild.owner || (BigInt(guild.permissions) & ADMINISTRATOR) === ADMINISTRATOR;
}

// Cache em memória dos servidores do bot (evita bater na API a cada request).
let botGuildsCache: { ids: Set<string>; at: number } | null = null;
const BOT_GUILDS_TTL = 5 * 60 * 1000;

/** IDs dos servidores onde o BOT está (via token do bot), cacheado por 5 min. */
export async function getBotGuildIds(): Promise<Set<string>> {
  if (botGuildsCache && Date.now() - botGuildsCache.at < BOT_GUILDS_TTL) return botGuildsCache.ids;

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return new Set();
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return botGuildsCache?.ids ?? new Set(); // em falha, reaproveita cache antigo
  const guilds = (await res.json()) as { id: string }[];
  botGuildsCache = { ids: new Set(guilds.map((g) => g.id)), at: Date.now() };
  return botGuildsCache.ids;
}

export function guildIconUrl(guild: { id: string; icon: string | null }): string | null {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64` : null;
}

// ---- Canais e cargos do servidor (pra preencher os menus do dashboard) ----

export interface Option {
  id: string;
  name: string;
}

interface RawChannel {
  id: string;
  name: string;
  type: number;
  position: number;
}
interface RawRole {
  id: string;
  name: string;
  position: number;
}

const TEXT_CHANNEL_TYPES = new Set([0, 5, 15]); // texto, anúncio, fórum
const CATEGORY_TYPE = 4;

const optionCache = new Map<string, { channels: Option[]; categories: Option[]; roles: Option[]; at: number }>();
const OPTIONS_TTL = 60 * 1000;

async function botFetch<T>(path: string): Promise<T | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Canais (texto), categorias e cargos de um servidor — cacheado por 60s. */
export async function getGuildOptions(guildId: string): Promise<{ channels: Option[]; categories: Option[]; roles: Option[] }> {
  const cached = optionCache.get(guildId);
  if (cached && Date.now() - cached.at < OPTIONS_TTL) return cached;

  const [rawChannels, rawRoles] = await Promise.all([
    botFetch<RawChannel[]>(`/guilds/${guildId}/channels`),
    botFetch<RawRole[]>(`/guilds/${guildId}/roles`),
  ]);

  if (!rawChannels || !rawRoles) {
    return cached ?? { channels: [], categories: [], roles: [] }; // em falha, reaproveita cache
  }

  const channels = rawChannels
    .filter((c) => TEXT_CHANNEL_TYPES.has(c.type))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));
  const categories = rawChannels
    .filter((c) => c.type === CATEGORY_TYPE)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));
  const roles = rawRoles
    .filter((r) => r.id !== guildId) // tira @everyone
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name }));

  const result = { channels, categories, roles, at: Date.now() };
  optionCache.set(guildId, result);
  return result;
}
