import { Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { discordTimestamp } from '../utils/formatter';
import { sendLog } from '../services/log.service';

const event: Event<'guildMemberAdd'> = {
  name: 'guildMemberAdd',
  async execute(_client: Client, member) {
    const embed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('📥 Membro entrou')
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${member.user} \`${member.user.tag}\`` },
        { name: 'ID', value: member.id, inline: true },
        { name: 'Membro nº', value: `${member.guild.memberCount}`, inline: true },
        {
          name: 'Conta criada',
          value: `${discordTimestamp(member.user.createdAt, 'D')} (${discordTimestamp(member.user.createdAt, 'R')})`
        }
      )
      .setTimestamp();

    await sendLog(member.guild, 'entrada', embed);
  }
};

export default event;
