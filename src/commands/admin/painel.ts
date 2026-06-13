import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyColor, applyUrl, errorEmbed, infoEmbed, Palette, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { buildAvatarEmbed, buildServerInfoEmbed, buildUserInfoEmbed } from '../../services/info.service';
import { warningRepository } from '../../repositories/warning.repository';
import { discordTimestamp, truncate } from '../../utils/formatter';

// ============ Botões do painel ============

async function handlePanelButton(interaction: ButtonInteraction): Promise<void> {
  const action = interaction.customId.split(':')[1];
  const member = interaction.inCachedGuild() ? interaction.member : null;

  if (action === 'server') {
    if (!interaction.inCachedGuild()) return;
    await interaction.reply({ embeds: [buildServerInfoEmbed(interaction.guild)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'perfil') {
    await interaction.reply({ embeds: [buildUserInfoEmbed(interaction.user, member)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'avatar') {
    await interaction.reply({ embeds: [buildAvatarEmbed(interaction.user, member)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'warns') {
    if (!interaction.inCachedGuild()) return;
    const warnings = await warningRepository.list(interaction.guildId, interaction.user.id);
    const embed =
      warnings.length === 0
        ? infoEmbed('Você não tem advertências. 🎉')
        : new EmbedBuilder()
            .setColor(Palette.warning)
            .setTitle(`Suas advertências (${warnings.length})`)
            .setDescription(
              truncate(
                warnings
                  .map((w) => `**#${w.id}** • ${truncate(w.reason, 150)} • ${discordTimestamp(w.createdAt, 'D')}`)
                  .join('\n\n'),
                4096
              )
            );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

const component: Component = {
  id: 'painel',
  execute(interaction: ComponentInteraction) {
    if (interaction.isButton()) return handlePanelButton(interaction);
  }
};

// ============ Comando ============

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Posta o painel central do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('titulo').setDescription('Título do painel.').setRequired(false))
    .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição (use \\n para pular linha).').setRequired(false))
    .addStringOption((opt) => opt.setName('cor').setDescription('Cor do embed (#RRGGBB ou nome).').setRequired(false))
    .addStringOption((opt) => opt.setName('imagem').setDescription('URL de uma imagem.').setRequired(false)),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem postar o painel.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!interaction.channel?.isSendable()) {
      await interaction.reply({ embeds: [errorEmbed('Não consigo enviar mensagens neste canal.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const titulo = interaction.options.getString('titulo') ?? '🤖 Central do Bot';
    const descricao = (interaction.options.getString('descricao') ?? 'Use os botões abaixo para acessar as funções do bot.').replace(
      /\\n/g,
      '\n'
    );
    const embed = new EmbedBuilder().setColor(Palette.info).setTitle(titulo).setDescription(descricao);

    const cor = interaction.options.getString('cor');
    const corInvalida = cor ? !applyColor(embed, cor) : false;
    const imagem = interaction.options.getString('imagem');
    if (imagem) applyUrl((url) => embed.setImage(url), imagem);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('painel:server').setLabel('Servidor').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('painel:perfil').setLabel('Meu perfil').setEmoji('👤').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('painel:avatar').setLabel('Meu avatar').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('painel:warns').setLabel('Advertências').setEmoji('⚠️').setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    const aviso = corInvalida ? '\n⚠️ Cor inválida — usei a cor padrão.' : '';
    await interaction.reply({ embeds: [successEmbed(`Painel postado! 🤖${aviso}`)], flags: MessageFlags.Ephemeral });
  }
};

export default command;
