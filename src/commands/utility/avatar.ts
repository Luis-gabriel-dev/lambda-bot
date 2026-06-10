import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Palette } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Mostra o avatar de um usuário.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário (padrão: você).').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('usuario') ?? interaction.user;
    const member = interaction.inCachedGuild()
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    // GuildMember.displayAvatarURL prioriza o avatar específico do servidor, se houver.
    const target = member ?? user;
    const color = member && member.displayColor !== 0 ? member.displayColor : Palette.info;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Avatar de ${user.username}`)
      .setImage(target.displayAvatarURL({ size: 1024 }))
      .setDescription(
        `[png](${target.displayAvatarURL({ size: 1024, extension: 'png' })}) · ` +
          `[jpg](${target.displayAvatarURL({ size: 1024, extension: 'jpg' })}) · ` +
          `[webp](${target.displayAvatarURL({ size: 1024, extension: 'webp' })})`
      );

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
