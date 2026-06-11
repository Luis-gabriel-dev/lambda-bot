import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'roleDelete'> = {
  name: 'roleDelete',
  async execute(_client: Client, role) {
    const executor = await findAuditExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);

    const embed = new EmbedBuilder()
      .setColor(Palette.error)
      .setTitle('➖ Cargo excluído')
      .addFields(
        { name: 'Cargo', value: `\`${role.name}\``, inline: true },
        { name: 'ID', value: role.id, inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(role.guild, 'cargos', embed);
  }
};

export default event;
