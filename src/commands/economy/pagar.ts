import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed } from '../../utils/embeds';
import { economyRepository } from '../../repositories/economy.repository';
import { CURRENCY } from '../../services/economy.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pagar')
    .setDescription('Transfere kurocoins do seu saldo para outro membro.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Quem vai receber.').setRequired(true))
    .addIntegerOption((opt) => opt.setName('quantia').setDescription('Quantos kurocoins transferir.').setMinValue(1).setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('usuario', true);
    const quantia = interaction.options.getInteger('quantia', true);

    if (user.id === interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed('Você não pode transferir kurocoins para si mesmo.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (user.bot) {
      await interaction.reply({ embeds: [errorEmbed('Você não pode transferir kurocoins para bots.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const result = await economyRepository.transfer(interaction.guildId, interaction.user.id, user.id, quantia);
    if (!result.ok) {
      await interaction.reply({
        embeds: [errorEmbed(`Saldo insuficiente. Você tem **${result.fromBalance.toLocaleString('pt-BR')}** ${CURRENCY}.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Mensagem pública.
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setDescription(
            `💸 ${interaction.user} transferiu **${quantia.toLocaleString('pt-BR')}** ${CURRENCY} para ${user}!\n` +
              `Seu novo saldo: **${result.fromBalance.toLocaleString('pt-BR')}** ${CURRENCY}.`
          )
      ]
    });
  }
};

export default command;
