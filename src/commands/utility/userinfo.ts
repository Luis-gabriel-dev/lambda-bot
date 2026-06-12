import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { buildUserInfoEmbed } from '../../services/info.service';

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

    await interaction.reply({ embeds: [buildUserInfoEmbed(user, member)] });
  }
};

export default command;
