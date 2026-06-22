import { redirect } from "next/navigation";
import { auth } from "./auth";
import { getBotGuildIds, getUserGuilds, isGuildAdmin, type DiscordGuild } from "./discord";

/** Servidores que o usuário pode gerenciar: admin/dono E onde o bot está. */
export async function getManageableGuilds(): Promise<DiscordGuild[]> {
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) return [];

  const [userGuilds, botGuilds] = await Promise.all([getUserGuilds(session.accessToken), getBotGuildIds()]);
  const isOwner = session.user.id === process.env.BOT_OWNER_ID;

  return userGuilds.filter((g) => botGuilds.has(g.id) && (isOwner || isGuildAdmin(g)));
}

/**
 * Garante (no servidor) que quem chamou pode gerenciar este servidor.
 * Em falha, redireciona pro /dashboard. Use em TODA página protegida e TODA action.
 */
export async function requireGuildAdmin(guildId: string) {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) redirect("/dashboard");

  const isOwner = session.user.id === process.env.BOT_OWNER_ID;
  if (!isOwner) {
    const userGuilds = await getUserGuilds(session.accessToken);
    const guild = userGuilds.find((g) => g.id === guildId);
    if (!guild || !isGuildAdmin(guild)) redirect("/dashboard");
  }

  const botGuilds = await getBotGuildIds();
  if (!botGuilds.has(guildId)) redirect("/dashboard");

  return session;
}
