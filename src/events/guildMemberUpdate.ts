import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { truncate } from '../utils/formatter';
import { sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'guildMemberUpdate'> = {
  name: 'guildMemberUpdate',
  async execute(_client: Client, oldMember, newMember) {
    // Sem o estado antigo em cache não dá pra comparar cargos com segurança.
    if (oldMember.partial) return;

    const added = [...newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id)).values()];
    const removed = [...oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id)).values()];
    if (added.length === 0 && removed.length === 0) return; // mudança não foi de cargos

    const executor = await findAuditExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);

    const embed = new EmbedBuilder()
      .setColor(Palette.info)
      .setTitle('🏷️ Cargos de membro atualizados')
      .setThumbnail(newMember.user.displayAvatarURL({ size: 256 }))
      .addFields({ name: 'Membro', value: `${newMember.user} \`${newMember.user.tag}\`` })
      .setTimestamp();

    if (added.length > 0) {
      embed.addFields({ name: '➕ Adicionados', value: truncate(added.map((r) => `${r}`).join(' '), 1024) });
    }
    if (removed.length > 0) {
      embed.addFields({ name: '➖ Removidos', value: truncate(removed.map((r) => `${r}`).join(' '), 1024) });
    }
    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\``, inline: true });

    await sendLog(newMember.guild, 'cargos', embed);
  }
};

export default event;
