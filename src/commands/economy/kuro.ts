import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed } from '../../utils/embeds';
import { isOwner } from '../../services/permission.service';
import { economyRepository } from '../../repositories/economy.repository';
import { CURRENCY, GOLD } from '../../services/economy.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kuro')
    .setDescription('🔒 Revela seus números reais de kurocoins (só o dono).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({ embeds: [errorEmbed('🤫 Esse é um comando secreto — só o dono pode usar.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const wallet = await economyRepository.getOrCreateWallet(interaction.guildId, interaction.user.id);
    const rank = await economyRepository.getRank(interaction.guildId, wallet.balance);
    const totalRanked = await economyRepository.countRanked(interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle('🔓 Seus números reais (mistério revelado)')
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .setDescription('No público você aparece como `???` e sempre no topo. Aqui estão os valores de verdade:')
      .addFields(
        { name: '💰 Saldo real', value: `**${wallet.balance.toLocaleString('pt-BR')}** ${CURRENCY}`, inline: true },
        { name: '🏆 Posição real', value: `#${rank} de ${totalRanked}`, inline: true },
        { name: '🔢 Coletas', value: `${wallet.collectCount}`, inline: true },
        { name: '📥 Total coletado', value: `${wallet.totalCollected.toLocaleString('pt-BR')} ${CURRENCY}`, inline: true }
      )
      .setFooter({ text: 'Só você vê isto. 🤐' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};

export default command;
