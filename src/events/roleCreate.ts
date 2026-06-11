import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'roleCreate'> = {
  name: 'roleCreate',
  async execute(_client: Client, role) {
    const executor = await findAuditExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);

    const embed = new EmbedBuilder()
      .setColor(role.color || Palette.success)
      .setTitle('➕ Cargo criado')
      .addFields(
        { name: 'Cargo', value: `${role} \`${role.name}\``, inline: true },
        { name: 'ID', value: role.id, inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(role.guild, 'cargos', embed);
  }
};

export default event;
