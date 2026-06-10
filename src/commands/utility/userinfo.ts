import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Palette } from '../../utils/embeds';
import { discordTimestamp, truncate } from '../../utils/formatter';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Mostra informações de um usuário.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário (padrão: você).').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('usuario') ?? interaction.user;
    const member = interaction.inCachedGuild()
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    const color = member && member.displayColor !== 0 ? member.displayColor : Palette.info;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Informações de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${user} \`${user.tag}\`` },
        { name: 'ID', value: user.id, inline: true },
        { name: 'Bot', value: user.bot ? 'Sim' : 'Não', inline: true },
        {
          name: 'Conta criada',
          value: `${discordTimestamp(user.createdAt, 'D')} (${discordTimestamp(user.createdAt, 'R')})`
        }
      );

    if (member) {
      if (member.joinedAt) {
        embed.addFields({
          name: 'Entrou no servidor',
          value: `${discordTimestamp(member.joinedAt, 'D')} (${discordTimestamp(member.joinedAt, 'R')})`
        });
      }

      const roles = [...member.roles.cache.values()]
        .filter((role) => role.id !== interaction.guildId)
        .sort((a, b) => b.position - a.position);

      if (roles.length > 0) {
        embed.addFields(
          { name: 'Maior cargo', value: `${roles[0]}`, inline: true },
          { name: `Cargos (${roles.length})`, value: truncate(roles.join(' '), 1024) }
        );
      }
    }

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
