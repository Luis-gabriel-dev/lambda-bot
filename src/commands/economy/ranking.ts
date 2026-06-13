import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { handleRankPage, showRanking } from '../../services/economy.service';

const component: Component = {
  id: 'ecorank',
  execute(interaction: ComponentInteraction) {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('ecorank:page:')) return handleRankPage(interaction);
  }
};

const command: Command = {
  data: new SlashCommandBuilder().setName('ranking').setDescription('Mostra o ranking de kurocoins do servidor.'),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    await showRanking(interaction);
  }
};

export default command;
