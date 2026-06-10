const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// Cache local: guarda o EmbedBuilder em edição de cada usuário (chave = user.id)
const editing = new Map();

// Linha de botões do editor — exportada para ser reutilizada após cada update
function buildControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('edit_content')
      .setLabel('Editar Conteúdo')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('edit_visual')
      .setLabel('Editar Visual')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('send_embed')
      .setLabel('Enviar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('cancel_embed')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Abre o editor de embed completo.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Título padrão')
      .setDescription('Descrição aqui…')
      .setColor('Blurple');

    await interaction.reply({
      content: 'Editor de Embed:',
      embeds: [embed],
      components: [buildControls()],
      flags: MessageFlags.Ephemeral
    });

    // Armazenar embed temporário em edição
    editing.set(interaction.user.id, embed);
  },

  editing,
  buildControls
};
