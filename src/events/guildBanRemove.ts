import { AuditLogEvent, Client, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';

const event: Event<'guildBanRemove'> = {
  name: 'guildBanRemove',
  async execute(_client: Client, ban) {
    let moderator = 'Desconhecido';

    if (ban.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      const logs = await ban.guild
        .fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 5 })
        .catch(() => null);
      const entry = logs?.entries.find((e) => e.target?.id === ban.user.id);
      if (entry?.executor) moderator = `${entry.executor.tag}`;
    }

    const embed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('✅ Banimento removido')
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${ban.user} \`${ban.user.tag}\``, inline: true },
        { name: 'Moderador', value: moderator, inline: true }
      )
      .setTimestamp();

    await sendLog(ban.guild, 'moderacao', embed);
  }
};

export default event;
