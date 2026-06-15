import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, StringSelectMenuInteraction } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { errorEmbed } from '../../utils/embeds';
import { economyRepository } from '../../repositories/economy.repository';
import { shopRepository } from '../../repositories/shop.repository';
import { buildShopPanel, purchaseRole } from '../../services/shop.service';

/** Seleção de um cargo no menu da loja → compra e re-renderiza o painel. */
async function handleBuy(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const roleId = interaction.values[0];
  if (!roleId) return;

  const result = await purchaseRole(interaction.member, roleId);

  // Atualiza o painel (saldo + cargos já possuídos) e devolve o resultado em particular.
  const wallet = await economyRepository.getOrCreateWallet(interaction.guildId, interaction.user.id);
  const roles = await shopRepository.listRoles(interaction.guildId);
  const panel = buildShopPanel(interaction.member, wallet, roles);
  await interaction.update({ embeds: [panel.embed], components: panel.components });
  await interaction.followUp({ embeds: [result.embed], flags: MessageFlags.Ephemeral });
}

const component: Component = {
  id: 'loja',
  execute(interaction: ComponentInteraction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'loja:buy') return handleBuy(interaction);
  }
};

const command: Command = {
  data: new SlashCommandBuilder().setName('loja').setDescription('Mostra a loja de cargos e seu saldo de kurocoins.'),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const wallet = await economyRepository.getOrCreateWallet(interaction.guildId, interaction.user.id);
    const roles = await shopRepository.listRoles(interaction.guildId);
    const panel = buildShopPanel(interaction.member, wallet, roles);
    await interaction.reply({ embeds: [panel.embed], components: panel.components, flags: MessageFlags.Ephemeral });
  }
};

export default command;
