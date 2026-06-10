import { Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { discordTimestamp, truncate } from '../utils/formatter';
import { sendLog } from '../services/log.service';

const event: Event<'guildMemberRemove'> = {
  name: 'guildMemberRemove',
  async execute(_client: Client, member) {
    const embed = new EmbedBuilder()
      .setColor(Palette.warning)
      .setTitle('📤 Membro saiu')
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${member.user} \`${member.user.tag}\`` },
        { name: 'ID', value: member.id, inline: true }
      )
      .setTimestamp();

    if (member.joinedAt) {
      embed.addFields({
        name: 'Tinha entrado',
        value: `${discordTimestamp(member.joinedAt, 'D')} (${discordTimestamp(member.joinedAt, 'R')})`
      });
    }

    const roles = [...member.roles.cache.values()]
      .filter((role) => role.id !== member.guild.id)
      .sort((a, b) => b.position - a.position);
    if (roles.length > 0) {
      embed.addFields({ name: `Cargos (${roles.length})`, value: truncate(roles.join(' '), 1024) });
    }

    await sendLog(member.guild, 'saida', embed);
  }
};

export default event;
