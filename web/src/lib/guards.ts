import { redirect } from "next/navigation";
import { auth } from "./auth";
import { getBotGuildIds, type AdminGuild } from "./discord";

/** Servidores que o usuário pode gerenciar: admin/dono E onde o bot está. */
export async function getManageableGuilds(): Promise<AdminGuild[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const botGuilds = await getBotGuildIds();
  return (session.adminGuilds ?? []).filter((g) => botGuilds.has(g.id));
}

/**
 * Garante (no servidor) que quem chamou pode gerenciar este servidor.
 * Usa a lista de admin guilds guardada na sessão (sem bater na API a cada request).
 * Em falha, redireciona pro /dashboard. Use em TODA página protegida e TODA action.
 */
export async function requireGuildAdmin(guildId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/dashboard");

  const isOwner = session.user.id === process.env.BOT_OWNER_ID;
  const isAdmin = isOwner || (session.adminGuilds ?? []).some((g) => g.id === guildId);
  if (!isAdmin) redirect("/dashboard");

  const botGuilds = await getBotGuildIds();
  if (!botGuilds.has(guildId)) redirect("/dashboard");

  return session;
}
