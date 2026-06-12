import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyUrl, errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { instagramRepository } from '../../repositories/instagram.repository';
import {
  buildDisclaimerEmbed,
  handleCancel,
  handleComment,
  handleConfirm,
  handleDelete,
  handleInfo,
  handleLike,
  handleLikers
} from '../../services/instagram.service';

const component: Component = {
  id: 'insta',
  execute(interaction: ComponentInteraction) {
    if (!interaction.isButton()) return;
    const cid = interaction.customId;
    if (cid === 'insta:like') return handleLike(interaction);
    if (cid === 'insta:comment') return handleComment(interaction);
    if (cid === 'insta:likers') return handleLikers(interaction);
    if (cid === 'insta:info') return handleInfo(interaction);
    if (cid === 'insta:delete') return handleDelete(interaction);
    if (cid.startsWith('insta:confirm:')) return handleConfirm(interaction);
    if (cid.startsWith('insta:cancel:')) return handleCancel(interaction);
  }
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('instagram')
    .setDescription('Configura os murais de fotos (mini Instagram).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('ativar')
        .setDescription('Ativa o mural de fotos em um canal (pode ter vários).')
        .addChannelOption((opt) =>
          opt.setName('canal').setDescription('Canal das fotos.').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addStringOption((opt) => opt.setName('imagem').setDescription('URL de uma imagem fixa para o aviso (opcional).').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('desativar')
        .setDescription('Desativa o mural de fotos em um canal.')
        .addChannelOption((opt) => opt.setName('canal').setDescription('Canal a desativar.').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('listar').setDescription('Lista os canais com mural de fotos ativo.'))
    .addSubcommand((sub) =>
      sub
        .setName('disclaimer')
        .setDescription('Reenvia o aviso de funcionamento em um canal.')
        .addChannelOption((opt) => opt.setName('canal').setDescription('Canal do mural.').setRequired(true))
    ),

  components: [component],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar o mural de fotos.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'listar') {
      const ids = await instagramRepository.getChannelIds(guildId);
      const value = ids.length > 0 ? ids.map((id) => `<#${id}>`).join(', ') : '*nenhum*';
      await interaction.reply({ embeds: [infoEmbed(`**Murais de fotos ativos:** ${value}`)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'ativar') {
      const canal = interaction.options.getChannel('canal', true);
      await instagramRepository.addChannel(guildId, canal.id);

      // Imagem fixa do aviso (opcional, validada).
      const imagemInput = interaction.options.getString('imagem');
      let imagemInvalida = false;
      if (imagemInput) {
        const tmp = new EmbedBuilder();
        if (applyUrl((url) => tmp.setImage(url), imagemInput)) await instagramRepository.setDisclaimerImage(canal.id, imagemInput);
        else imagemInvalida = true;
      }

      const imageUrl = await instagramRepository.getDisclaimerImageUrl(canal.id);
      const channel = await interaction.guild.channels.fetch(canal.id).catch(() => null);
      if (channel?.isSendable()) await channel.send({ embeds: [buildDisclaimerEmbed(imageUrl)] });

      const aviso = imagemInvalida ? '\n⚠️ Imagem inválida — ignorada.' : '';
      await interaction.reply({
        embeds: [successEmbed(`Mural de fotos ativado em <#${canal.id}>. As fotos enviadas lá viram posts.${aviso}`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'desativar') {
      const canal = interaction.options.getChannel('canal', true);
      const removed = await instagramRepository.removeChannel(guildId, canal.id);
      await interaction.reply({
        embeds: [removed ? successEmbed(`Mural de fotos desativado em <#${canal.id}>.`) : errorEmbed('Esse canal não tinha mural ativo.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // disclaimer
    const canal = interaction.options.getChannel('canal', true);
    if (!(await instagramRepository.isInstaChannel(guildId, canal.id))) {
      await interaction.reply({ embeds: [errorEmbed('Esse canal não tem mural de fotos ativo.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const imageUrl = await instagramRepository.getDisclaimerImageUrl(canal.id);
    const channel = await interaction.guild.channels.fetch(canal.id).catch(() => null);
    if (channel?.isSendable()) await channel.send({ embeds: [buildDisclaimerEmbed(imageUrl)] });
    await interaction.reply({ embeds: [successEmbed('Aviso reenviado.')], flags: MessageFlags.Ephemeral });
  }
};

export default command;
