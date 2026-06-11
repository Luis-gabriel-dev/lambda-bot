import { AttachmentBuilder, EmbedBuilder, Guild, GuildTextBasedChannel } from 'discord.js';
import { logChannelRepository } from '../repositories/logChannel.repository';

/** Tipos de log suportados → rótulo legível (usado nas choices do /logs e nas listagens). */
export const LOG_TYPES = {
  punicoes: 'Punições',
  bans: 'Bans',
  entrada: 'Entrada de membros',
  saida: 'Saída de membros',
  mensagens: 'Mensagens',
  calls: 'Calls',
  tickets: 'Tickets',
  audit: 'Auditoria de mensagens',
  moderacao: 'Moderação (warns, unmute, unban)',
  cargos: 'Cargos (criação, exclusão, atribuição)'
} as const;

export type LogType = keyof typeof LOG_TYPES;

export function isLogType(value: string): value is LogType {
  return value in LOG_TYPES;
}

/** Resolve o canal configurado para um tipo de log (ou null se não houver / inacessível). */
export async function resolveLogChannel(guild: Guild, type: LogType): Promise<GuildTextBasedChannel | null> {
  const channelId = await logChannelRepository.getChannelId(guild.id, type);
  if (!channelId) return null;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel && channel.isTextBased() ? channel : null;
}

/**
 * Envia um embed (e arquivos opcionais) para o canal configurado de um tipo de log.
 * Silencioso se o tipo não estiver configurado ou o canal for inacessível.
 * Se o envio com arquivos falhar (ex.: URL expirada), tenta de novo só com o embed.
 */
export async function sendLog(
  guild: Guild,
  type: LogType,
  embed: EmbedBuilder,
  files?: AttachmentBuilder[]
): Promise<void> {
  const channel = await resolveLogChannel(guild, type);
  if (!channel) return;

  try {
    await channel.send(files && files.length > 0 ? { embeds: [embed], files } : { embeds: [embed] });
  } catch {
    if (files && files.length > 0) {
      await channel.send({ embeds: [embed] }).catch(() => undefined);
    }
  }
}
