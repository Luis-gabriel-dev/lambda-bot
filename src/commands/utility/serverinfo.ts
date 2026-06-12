import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed } from '../../utils/embeds';
import { buildServerInfoEmbed } from '../../services/info.service';

const command: Command = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Mostra informações do servidor.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({ embeds: [buildServerInfoEmbed(interaction.guild)] });
  }
};

export default command;
