import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyColor, applyUrl } from '../../utils/embeds';

// Estado de edição por usuário (em memória; é perdido ao reiniciar o bot).
const editing = new Map<string, EmbedBuilder>();

function buildControls(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embed:edit_content').setLabel('Editar Conteúdo').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('embed:edit_visual').setLabel('Editar Visual').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed:send').setLabel('Enviar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('embed:cancel').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
  );
}

/** Cria um campo de modal já pré-preenchido com o valor atual (se houver). */
function textInput(id: string, label: string, style: TextInputStyle, current?: string | null): TextInputBuilder {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false);
  if (current) input.setValue(String(current).slice(0, 4000));
  return input;
}

/** Converte a cor numérica do embed em hex (#RRGGBB) para exibir no modal. */
function colorToHex(color?: number | null): string {
  return typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : '';
}

function rowOf(input: TextInputBuilder): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

// ---------------- Handlers de botão ----------------

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const embed = editing.get(interaction.user.id);
  if (!embed) {
    await interaction.reply({ content: 'Esse editor expirou. Use /embed novamente.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.customId === 'embed:edit_content') {
    const modal = new ModalBuilder().setCustomId('embed:modal_content').setTitle('Editar Conteúdo');
    modal.addComponents(
      rowOf(textInput('new_title', 'Título', TextInputStyle.Short, embed.data.title)),
      rowOf(textInput('new_url', 'URL do título', TextInputStyle.Short, embed.data.url)),
      rowOf(textInput('new_author', 'Autor', TextInputStyle.Short, embed.data.author?.name)),
      rowOf(textInput('new_desc', 'Descrição', TextInputStyle.Paragraph, embed.data.description))
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.customId === 'embed:edit_visual') {
    const modal = new ModalBuilder().setCustomId('embed:modal_visual').setTitle('Editar Visual');
    modal.addComponents(
      rowOf(textInput('new_color', 'Cor (#RRGGBB ou nome)', TextInputStyle.Short, colorToHex(embed.data.color))),
      rowOf(textInput('new_footer', 'Footer', TextInputStyle.Short, embed.data.footer?.text)),
      rowOf(textInput('new_image', 'Imagem (URL)', TextInputStyle.Short, embed.data.image?.url)),
      rowOf(textInput('new_thumbnail', 'Thumbnail (URL)', TextInputStyle.Short, embed.data.thumbnail?.url))
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.customId === 'embed:send') {
    if (interaction.channel?.isSendable()) {
      await interaction.channel.send({ embeds: [embed] });
    }
    editing.delete(interaction.user.id);
    await interaction.update({ content: 'Embed enviado! ✅', embeds: [embed], components: [] });
    return;
  }

  if (interaction.customId === 'embed:cancel') {
    editing.delete(interaction.user.id);
    await interaction.update({ content: 'Edição cancelada.', embeds: [], components: [] });
  }
}

// ---------------- Handler de modal ----------------

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.isFromMessage()) return;

  const embed = editing.get(interaction.user.id);
  if (!embed) {
    await interaction.reply({ content: 'Esse editor expirou. Use /embed novamente.', flags: MessageFlags.Ephemeral });
    return;
  }

  const warnings: string[] = [];

  if (interaction.customId === 'embed:modal_content') {
    const title = interaction.fields.getTextInputValue('new_title').trim();
    const url = interaction.fields.getTextInputValue('new_url').trim();
    const author = interaction.fields.getTextInputValue('new_author').trim();
    const desc = interaction.fields.getTextInputValue('new_desc').trim();

    embed.setTitle(title || null);
    embed.setDescription(desc || null);
    embed.setAuthor(author ? { name: author } : null);
    if (url) {
      if (!applyUrl((u) => embed.setURL(u), url)) warnings.push('URL do título inválida (ignorada).');
    } else {
      embed.setURL(null);
    }
  } else if (interaction.customId === 'embed:modal_visual') {
    const color = interaction.fields.getTextInputValue('new_color').trim();
    const footer = interaction.fields.getTextInputValue('new_footer').trim();
    const image = interaction.fields.getTextInputValue('new_image').trim();
    const thumb = interaction.fields.getTextInputValue('new_thumbnail').trim();

    if (color && !applyColor(embed, color)) warnings.push('Cor inválida (ignorada).');
    embed.setFooter(footer ? { text: footer } : null);
    if (image) {
      if (!applyUrl((u) => embed.setImage(u), image)) warnings.push('Imagem inválida (ignorada).');
    } else {
      embed.setImage(null);
    }
    if (thumb) {
      if (!applyUrl((u) => embed.setThumbnail(u), thumb)) warnings.push('Thumbnail inválida (ignorada).');
    } else {
      embed.setThumbnail(null);
    }
  } else {
    return;
  }

  await interaction.update({
    content: warnings.length ? `Editor de Embed:\n⚠️ ${warnings.join(' ')}` : 'Editor de Embed:',
    embeds: [embed],
    components: [buildControls()]
  });
}

const component: Component = {
  id: 'embed',
  execute(interaction: ComponentInteraction) {
    if (interaction.isButton()) return handleButton(interaction);
    if (interaction.isModalSubmit()) return handleModal(interaction);
  }
};

const command: Command = {
  data: new SlashCommandBuilder().setName('embed').setDescription('Abre o editor de embed completo.'),
  components: [component],
  async execute(interaction: ChatInputCommandInteraction) {
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

    editing.set(interaction.user.id, embed);
  }
};

export default command;
