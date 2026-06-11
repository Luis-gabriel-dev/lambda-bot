import { AuditLogEvent, Guild, PermissionFlagsBits, User } from 'discord.js';

/**
 * Procura no audit log quem executou uma ação recente sobre um alvo.
 * Retorna o executor (User) ou null se não houver permissão / não encontrar.
 */
export async function findAuditExecutor(
  guild: Guild,
  type: AuditLogEvent,
  targetId: string,
  withinMs = 8000
): Promise<User | null> {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  if (!logs) return null;

  const entry = logs.entries.find((e) => {
    const target = e.target as { id?: string } | null;
    return target?.id === targetId && Date.now() - e.createdTimestamp < withinMs;
  });

  const executor = entry?.executor ?? null;
  return executor && !executor.partial ? executor : null;
}
