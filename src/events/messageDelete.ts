import {
  Attachment,
  AttachmentBuilder,
  AuditLogEvent,
  Client,
  Collection,
  EmbedBuilder,
  Guild,
  PermissionFlagsBits
} from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { truncate } from '../utils/formatter';
import { sendLog } from '../services/log.service';

const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;

/**
 * Tenta achar no audit log quem apagou a mensagem. Só registra quando OUTRA
 * pessoa (mod/admin/bot) apaga — auto-deleção não aparece no audit log.
 */
async function findDeletion(guild: Guild, channelId: string, authorId?: string) {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

  const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 }).catch(() => null);
  return (
    logs?.entries.find(
      (e) =>
        e.extra?.channel?.id === channelId &&
        (authorId ? e.target?.id === authorId : true) &&
        Date.now() - e.createdTimestamp < 8000
    ) ?? null
  );
}

const event: Event<'messageDelete'> = {
  name: 'messageDelete',
  async execute(_client: Client, message) {
    const guild = message.guild;
    if (!guild) return;

    // ---- Mensagem fora do cache: sem conteúdo, mas dá pra logar se foi um mod ----
    if (message.partial) {
      const entry = await findDeletion(guild, message.channelId);
      if (!entry?.executor || !entry.target || entry.target.bot) return; // auto-deleção não cacheada → ignora

      const embed = new EmbedBuilder()
        .setColor(Palette.error)
        .setTitle('🗑️ Mensagem apagada')
        .setThumbnail(entry.target.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Autor', value: `${entry.target} \`${entry.target.tag}\``, inline: true },
          { name: 'Apagada por', value: `${entry.executor} \`${entry.executor.tag}\``, inline: true },
          { name: 'Canal', value: `<#${message.channelId}>` },
          { name: 'Conteúdo', value: '*(não estava em cache — conteúdo indisponível)*' }
        )
        .setTimestamp();

      await sendLog(guild, 'mensagens', embed);
      return;
    }

    if (message.author.bot) return;

    const entry = await findDeletion(guild, message.channelId, message.author.id);
    const deletedBy = entry?.executor
      ? `${entry.executor} \`${entry.executor.tag}\``
      : 'Provavelmente o próprio autor';

    // Mensagens encaminhadas guardam o conteúdo original em messageSnapshots.
    const snapshots = [...message.messageSnapshots.values()];
    const isForward = snapshots.length > 0;

    const embed = new EmbedBuilder()
      .setColor(Palette.error)
      .setTitle(isForward ? '🗑️ Mensagem encaminhada apagada' : '🗑️ Mensagem apagada')
      .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Autor', value: `${message.author} \`${message.author.tag}\``, inline: true },
        { name: 'Apagada por', value: deletedBy, inline: true },
        { name: 'Canal', value: `<#${message.channelId}>` },
        { name: 'Conteúdo', value: truncate(message.content || '*(sem texto)*', 1024) }
      )
      .setTimestamp();

    // Re-upload de todos os anexos (próprios + encaminhados) para preservá-los.
    const files: AttachmentBuilder[] = [];
    const names: string[] = [];
    let inlineImage: string | undefined;
    let index = 0;
    const addAttachments = (attachments: Collection<string, Attachment>) => {
      for (const attachment of attachments.values()) {
        const base = (attachment.name ?? 'arquivo').replace(/[^\w.\-]+/g, '_');
        const safeName = `${index++}-${base}`;
        files.push(new AttachmentBuilder(attachment.url, { name: safeName }));
        names.push(attachment.name ?? 'arquivo');
        if (!inlineImage && (attachment.contentType?.startsWith('image/') || IMAGE_RE.test(attachment.name ?? ''))) {
          inlineImage = `attachment://${safeName}`;
        }
      }
    };

    addAttachments(message.attachments);

    if (isForward) {
      const forwardedText = snapshots
        .map((snap) => snap.content)
        .filter((content): content is string => Boolean(content))
        .join('\n\n');
      embed.addFields({ name: '📨 Encaminhamento (conteúdo original)', value: truncate(forwardedText || '*(sem texto)*', 1024) });
      for (const snap of snapshots) addAttachments(snap.attachments);
    }

    if (files.length > 0) {
      embed.addFields({ name: `Anexos (${files.length})`, value: truncate(names.join(', '), 1024) });
    }
    if (inlineImage) embed.setImage(inlineImage);

    await sendLog(guild, 'mensagens', embed, files);
  }
};

export default event;
