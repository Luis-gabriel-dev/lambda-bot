import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed } from '../../utils/embeds';
import { purchaseRole } from '../../services/shop.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('comprar')
    .setDescription('Compra um cargo da loja com kurocoins.')
    .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo que deseja comprar.').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const cargo = interaction.options.getRole('cargo', true);
    const result = await purchaseRole(interaction.member, cargo.id);
    await interaction.reply({ embeds: [result.embed], flags: MessageFlags.Ephemeral });
  }
};

export default command;
