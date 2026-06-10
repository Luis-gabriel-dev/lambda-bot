import { AuditLogEvent, Client, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';

const event: Event<'guildBanAdd'> = {
  name: 'guildBanAdd',
  async execute(_client: Client, ban) {
    let reason = ban.reason ?? 'Sem motivo informado';
    let moderator = 'Desconhecido';

    // Tenta descobrir o moderador responsável via audit log (se eu tiver permissão).
    if (ban.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      const logs = await ban.guild
        .fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 })
        .catch(() => null);
      const entry = logs?.entries.find((e) => e.target?.id === ban.user.id);
      if (entry) {
        if (entry.executor) moderator = `${entry.executor.tag}`;
        if (entry.reason) reason = entry.reason;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(Palette.error)
      .setTitle('🔨 Membro banido')
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${ban.user} \`${ban.user.tag}\`` },
        { name: 'ID', value: ban.user.id, inline: true },
        { name: 'Moderador', value: moderator, inline: true },
        { name: 'Motivo', value: reason }
      )
      .setTimestamp();

    await sendLog(ban.guild, 'bans', embed);
  }
};

export default event;
