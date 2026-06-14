import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { Component, ComponentInteraction } from '../../interfaces/Component';
import { applyColor, applyUrl, errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
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
  handleLikers,
  handleTitle,
  handleTitleModal
} from '../../services/instagram.service';

const component: Component = {
  id: 'insta',
  execute(interaction: ComponentInteraction) {
    const cid = interaction.customId;
    if (interaction.isModalSubmit()) {
      if (cid.startsWith('insta:titlemodal:')) return handleTitleModal(interaction);
      return;
    }
    if (!interaction.isButton()) return;
    if (cid === 'insta:like') return handleLike(interaction);
    if (cid === 'insta:comment') return handleComment(interaction);
    if (cid === 'insta:likers') return handleLikers(interaction);
    if (cid === 'insta:info') return handleInfo(interaction);
    if (cid === 'insta:delete') return handleDelete(interaction);
    if (cid.startsWith('insta:title:')) return handleTitle(interaction);
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
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Define a imagem e/ou a cor do embed de informação (ℹ️) de um canal.')
        .addChannelOption((opt) => opt.setName('canal').setDescription('Canal do mural.').setRequired(true))
        .addStringOption((opt) => opt.setName('imagem').setDescription('URL da imagem (ou "remover" para tirar).').setRequired(false))
        .addStringOption((opt) => opt.setName('cor').setDescription('Cor #RRGGBB ou nome (ex.: Blurple).').setRequired(false))
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

      await sendDisclaimerMessage(interaction.guild, canal.id);

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

    const canal = interaction.options.getChannel('canal', true);
    if (!(await instagramRepository.isInstaChannel(guildId, canal.id))) {
      await interaction.reply({ embeds: [errorEmbed('Esse canal não tem mural de fotos ativo.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'info') {
      const imagemInput = interaction.options.getString('imagem');
      const corInput = interaction.options.getString('cor');
      if (!imagemInput && !corInput) {
        await interaction.reply({ embeds: [errorEmbed('Informe a `imagem` e/ou a `cor` para mudar.')], flags: MessageFlags.Ephemeral });
        return;
      }

      const avisos: string[] = [];
      if (imagemInput) {
        if (imagemInput.trim().toLowerCase() === 'remover') {
          await instagramRepository.setDisclaimerImage(canal.id, null);
          avisos.push('imagem removida');
        } else {
          const tmp = new EmbedBuilder();
          if (applyUrl((u) => tmp.setImage(u), imagemInput)) {
            await instagramRepository.setDisclaimerImage(canal.id, imagemInput.trim());
            avisos.push('imagem atualizada');
          } else avisos.push('⚠️ imagem inválida (ignorada)');
        }
      }
      if (corInput) {
        const tmp = new EmbedBuilder();
        if (applyColor(tmp, corInput) && typeof tmp.data.color === 'number') {
          await instagramRepository.setDisclaimerColor(canal.id, tmp.data.color);
          avisos.push('cor atualizada');
        } else avisos.push('⚠️ cor inválida (ignorada)');
      }

      await sendDisclaimerMessage(interaction.guild, canal.id);
      await interaction.reply({
        embeds: [successEmbed(`Embed de informação de <#${canal.id}>: ${avisos.join(', ')}. Aviso reenviado.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // disclaimer
    await sendDisclaimerMessage(interaction.guild, canal.id);
    await interaction.reply({ embeds: [successEmbed('Aviso reenviado.')], flags: MessageFlags.Ephemeral });
  }
};

/** Reenvia o embed de informação no canal, com a imagem, a cor e o ícone do servidor configurados. */
async function sendDisclaimerMessage(guild: Guild, channelId: string): Promise<void> {
  const cfg = await instagramRepository.getDisclaimerConfig(channelId);
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel?.isSendable()) {
    await channel.send({
      embeds: [buildDisclaimerEmbed({ imageUrl: cfg.imageUrl, color: cfg.color, guildIcon: guild.iconURL({ size: 128 }) })]
    });
  }
}

export default command;
