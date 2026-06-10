const {
  InteractionType,
  EmbedBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  MessageFlags
} = require('discord.js');
const embedCommand = require('../commands/embed');

// ---------- Helpers ----------

// Cria um campo de texto já pré-preenchido com o valor atual (se houver)
function textInput(id, label, style, currentValue) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(false);
  if (currentValue) input.setValue(String(currentValue).slice(0, 4000));
  return input;
}

// Converte a cor numérica do embed para hex (#RRGGBB) para mostrar no modal
function colorToHex(color) {
  if (typeof color !== 'number') return '';
  return '#' + color.toString(16).padStart(6, '0');
}

// Aplica a cor de forma segura. Retorna true em sucesso, false se inválida.
function applyColor(embed, value) {
  const v = value.trim();
  try {
    // Aceita "RRGGBB" sem '#' além dos formatos nativos (#RRGGBB, nomes, etc.)
    if (/^[0-9a-fA-F]{6}$/.test(v)) {
      embed.setColor(parseInt(v, 16));
    } else {
      embed.setColor(v);
    }
    return true;
  } catch {
    return false;
  }
}

// Aplica uma URL de imagem de forma segura. Retorna true em sucesso, false se inválida.
function applyImage(setter, value) {
  try {
    setter(value.trim());
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  name: 'interactionCreate',
  execute: async (interaction) => {
    try {
      // -------------------------
      // COMANDOS SLASH
      // -------------------------
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      // -------------------------
      // BOTÕES
      // -------------------------
      if (interaction.isButton()) {
        const embed = embedCommand.editing.get(interaction.user.id);
        if (!embed) {
          return interaction.reply({
            content: 'Esse editor expirou. Use /embed novamente.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (interaction.customId === 'edit_content') {
          const modal = new ModalBuilder()
            .setCustomId('modal_content')
            .setTitle('Editar Conteúdo');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              textInput('new_title', 'Título', TextInputStyle.Short, embed.data.title)
            ),
            new ActionRowBuilder().addComponents(
              textInput('new_url', 'URL do título', TextInputStyle.Short, embed.data.url)
            ),
            new ActionRowBuilder().addComponents(
              textInput('new_author', 'Autor', TextInputStyle.Short, embed.data.author?.name)
            ),
            new ActionRowBuilder().addComponents(
              textInput('new_desc', 'Descrição', TextInputStyle.Paragraph, embed.data.description)
            )
          );

          return interaction.showModal(modal);
        }

        if (interaction.customId === 'edit_visual') {
          const modal = new ModalBuilder()
            .setCustomId('modal_visual')
            .setTitle('Editar Visual');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              textInput('new_color', 'Cor (#RRGGBB ou nome)', TextInputStyle.Short, colorToHex(embed.data.color))
            ),
            new ActionRowBuilder().addComponents(
              textInput('new_footer', 'Footer', TextInputStyle.Short, embed.data.footer?.text)
            ),
            new ActionRowBuilder().addComponents(
              textInput('new_image', 'Imagem (URL)', TextInputStyle.Short, embed.data.image?.url)
            ),
            new ActionRowBuilder().addComponents(
              textInput('new_thumbnail', 'Thumbnail (URL)', TextInputStyle.Short, embed.data.thumbnail?.url)
            )
          );

          return interaction.showModal(modal);
        }

        if (interaction.customId === 'send_embed') {
          // Usa o embed em cache (fonte da verdade), não o da mensagem efêmera
          await interaction.channel.send({ embeds: [embed] });
          embedCommand.editing.delete(interaction.user.id);
          return interaction.update({
            content: 'Embed enviado! ✅',
            embeds: [embed],
            components: []
          });
        }

        if (interaction.customId === 'cancel_embed') {
          embedCommand.editing.delete(interaction.user.id);
          return interaction.update({
            content: 'Edição cancelada.',
            embeds: [],
            components: []
          });
        }
      }

      // -------------------------
      // MODAIS
      // -------------------------
      if (interaction.type === InteractionType.ModalSubmit) {
        const embed = embedCommand.editing.get(interaction.user.id);
        if (!embed) {
          return interaction.reply({
            content: 'Esse editor expirou. Use /embed novamente.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (interaction.customId === 'modal_content') {
          const newTitle = interaction.fields.getTextInputValue('new_title').trim();
          const newUrl = interaction.fields.getTextInputValue('new_url').trim();
          const newAuthor = interaction.fields.getTextInputValue('new_author').trim();
          const newDesc = interaction.fields.getTextInputValue('new_desc').trim();
          const warnings = [];

          embed.setTitle(newTitle || null);
          embed.setDescription(newDesc || null);
          embed.setAuthor(newAuthor ? { name: newAuthor } : null);

          if (newUrl) {
            if (!applyImage((u) => embed.setURL(u), newUrl)) warnings.push('URL do título inválida (ignorada).');
          } else {
            embed.setURL(null);
          }

          return interaction.update({
            content: warnings.length ? `Editor de Embed:\n⚠️ ${warnings.join(' ')}` : 'Editor de Embed:',
            embeds: [embed],
            components: [embedCommand.buildControls()]
          });
        }

        if (interaction.customId === 'modal_visual') {
          const newColor = interaction.fields.getTextInputValue('new_color').trim();
          const newFooter = interaction.fields.getTextInputValue('new_footer').trim();
          const newImage = interaction.fields.getTextInputValue('new_image').trim();
          const newThumb = interaction.fields.getTextInputValue('new_thumbnail').trim();
          const warnings = [];

          if (newColor) {
            if (!applyColor(embed, newColor)) warnings.push('Cor inválida (ignorada).');
          }

          embed.setFooter(newFooter ? { text: newFooter } : null);

          if (newImage) {
            if (!applyImage((u) => embed.setImage(u), newImage)) warnings.push('Imagem inválida (ignorada).');
          } else {
            embed.setImage(null);
          }

          if (newThumb) {
            if (!applyImage((u) => embed.setThumbnail(u), newThumb)) warnings.push('Thumbnail inválida (ignorada).');
          } else {
            embed.setThumbnail(null);
          }

          return interaction.update({
            content: warnings.length ? `Editor de Embed:\n⚠️ ${warnings.join(' ')}` : 'Editor de Embed:',
            embeds: [embed],
            components: [embedCommand.buildControls()]
          });
        }
      }
    } catch (err) {
      console.error('Erro na interação:', err);
      // Tenta dar algum feedback ao usuário em vez de deixar "A interação falhou"
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: 'Ocorreu um erro ao processar essa ação.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  }
};
