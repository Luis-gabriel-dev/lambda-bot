import { AttachmentBuilder, EmbedBuilder, Guild, Message, PermissionFlagsBits } from 'discord.js';
import { logChannelRepository } from '../repositories/logChannel.repository';
import { resolveLogChannel } from './log.service';
import { Palette } from '../utils/embeds';

/** Há canal de auditoria configurado? (evita varreduras caras quando não há onde postar) */
export async function isAuditEnabled(guildId: string): Promise<boolean> {
  return (await logChannelRepository.getChannelId(guildId, 'audit')) !== null;
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

/** Monta o transcript em texto legível, agrupado por canal. */
function buildTranscript(messages: Message[], meta: { guild: Guild; title: string; reason: string }): string {
  const lines: string[] = [
    `Auditoria de mensagens — ${meta.title}`,
    `Servidor: ${meta.guild.name} (${meta.guild.id})`,
    `Motivo: ${meta.reason}`,
    `Gerado em: ${fmtDate(Date.now())} (UTC)`,
    `Total: ${messages.length} mensagem(ns)`,
    '='.repeat(50)
  ];

  const sorted = [...messages].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const byChannel = new Map<string, Message[]>();
  for (const m of sorted) {
    const key = 'name' in m.channel && m.channel.name ? `#${m.channel.name}` : m.channelId;
    const list = byChannel.get(key) ?? [];
    list.push(m);
    byChannel.set(key, list);
  }

  for (const [channelName, msgs] of byChannel) {
    lines.push('', `──── ${channelName} ────`);
    for (const m of msgs) {
      lines.push(`[${fmtDate(m.createdTimestamp)}] ${m.author.tag} (${m.author.id}): ${m.content || '[sem texto]'}`);
      for (const a of m.attachments.values()) {
        lines.push(`    ↳ anexo: ${a.name ?? 'arquivo'} — ${a.url}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Gera o arquivo .txt de auditoria e posta no canal de auditoria.
 * No-op se não houver mensagens ou canal de auditoria configurado.
 */
export async function archiveMessages(
  guild: Guild,
  title: string,
  reason: string,
  messages: Message[]
): Promise<boolean> {
  if (messages.length === 0) return false;
  const channel = await resolveLogChannel(guild, 'audit');
  if (!channel) return false;

  const content = buildTranscript(messages, { guild, title, reason });
  const file = new AttachmentBuilder(Buffer.from(content, 'utf-8'), { name: `audit-${Date.now()}.txt` });

  const embed = new EmbedBuilder()
    .setColor(Palette.info)
    .setTitle('🗂️ Auditoria de mensagens')
    .addFields(
      { name: 'Origem', value: title, inline: true },
      { name: 'Mensagens', value: `${messages.length}`, inline: true },
      { name: 'Motivo', value: reason }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed], files: [file] }).catch(() => undefined);
  return true;
}

/** Varre os canais de texto coletando as mensagens recentes de um usuário (parcial). */
export async function collectUserMessages(guild: Guild, userId: string, maxPerChannel = 100): Promise<Message[]> {
  const collected: Message[] = [];
  const me = guild.members.me;

  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased()) continue;
    if (me) {
      const perms = channel.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.ReadMessageHistory)) continue;
    }
    const batch = await channel.messages.fetch({ limit: maxPerChannel }).catch(() => null);
    if (!batch) continue;
    for (const m of batch.values()) {
      if (m.author.id === userId) collected.push(m);
    }
  }

  return collected;
}
