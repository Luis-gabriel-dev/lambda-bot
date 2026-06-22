// Helpers da API do Discord usados no servidor (nunca no cliente).

const ADMINISTRATOR = BigInt(0x8); // permissão de administrador

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

/** Servidores do usuário logado (via token de acesso do OAuth). */
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

/** IDs dos servidores onde o BOT está (via token do bot). */
export async function getBotGuildIds(): Promise<Set<string>> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return new Set();
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return new Set();
  const guilds = (await res.json()) as { id: string }[];
  return new Set(guilds.map((g) => g.id));
}

export function guildIconUrl(guild: DiscordGuild): string | null {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64` : null;
}
