import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { channelTypeLabel, sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'threadCreate'> = {
  name: 'threadCreate',
  async execute(client: Client, thread, newlyCreated) {
    if (!newlyCreated) return; // ignora tópicos que só ficaram visíveis (não recém-criados)
    const executor = await findAuditExecutor(thread.guild, AuditLogEvent.ThreadCreate, thread.id);
    // Ignora tópicos criados pelo próprio bot (ex.: comentários do mini Instagram).
    if (executor && executor.id === client.user?.id) return;

    const embed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('➕ Tópico criado')
      .addFields(
        { name: 'Tópico', value: `${thread} \`${thread.name}\``, inline: true },
        { name: 'Canal', value: thread.parent ? `${thread.parent}` : '—', inline: true },
        { name: 'Tipo', value: channelTypeLabel(thread.type), inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(thread.guild, 'servidor', embed);
  }
};

export default event;
