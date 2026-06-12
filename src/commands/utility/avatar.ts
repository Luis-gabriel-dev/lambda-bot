import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { buildAvatarEmbed } from '../../services/info.service';

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

    await interaction.reply({ embeds: [buildAvatarEmbed(user, member)] });
  }
};

export default command;
