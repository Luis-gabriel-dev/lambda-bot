import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { channelTypeLabel, sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'threadDelete'> = {
  name: 'threadDelete',
  async execute(client: Client, thread) {
    const executor = await findAuditExecutor(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
    // Ignora tópicos apagados pelo próprio bot (ex.: limpeza de threads vazias do Instagram).
    if (executor && executor.id === client.user?.id) return;

    const embed = new EmbedBuilder()
      .setColor(Palette.error)
      .setTitle('🗑️ Tópico apagado')
      .addFields(
        { name: 'Tópico', value: `\`${thread.name}\``, inline: true },
        { name: 'Canal', value: thread.parent ? `${thread.parent}` : '—', inline: true },
        { name: 'Tipo', value: channelTypeLabel(thread.type), inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(thread.guild, 'servidor', embed);
  }
};

export default event;
