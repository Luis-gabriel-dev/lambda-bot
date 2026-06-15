import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed } from '../../utils/embeds';
import { isOwner } from '../../services/permission.service';
import { economyRepository } from '../../repositories/economy.repository';
import { buildProfileEmbed } from '../../services/economy.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Mostra o perfil de kurocoins.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário (padrão: você).').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('usuario') ?? interaction.user;
    let wallet = await economyRepository.getWallet(interaction.guildId, user.id);
    if (!wallet) {
      // O dono sempre tem um perfil (mascarado), mesmo sem carteira ainda.
      if (!isOwner(user.id)) {
        const quem = user.id === interaction.user.id ? 'Você ainda não tem' : `**${user.username}** ainda não tem`;
        await interaction.reply({ embeds: [errorEmbed(`${quem} perfil. Use **/coletar** para começar!`)], flags: MessageFlags.Ephemeral });
        return;
      }
      wallet = await economyRepository.getOrCreateWallet(interaction.guildId, user.id);
    }

    const rank = await economyRepository.getRank(interaction.guildId, wallet.balance);
    await interaction.reply({ embeds: [buildProfileEmbed(user, wallet, rank)] });
  }
};

export default command;
