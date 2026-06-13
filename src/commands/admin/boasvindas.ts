import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { applyUrl, errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { guildConfigRepository } from '../../repositories/guildConfig.repository';
import { buildWelcome } from '../../services/welcome.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('boasvindas')
    .setDescription('Configura as boas-vindas dos novos membros.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('canal')
        .setDescription('Define o canal público de boas-vindas.')
        .addChannelOption((opt) =>
          opt.setName('canal').setDescription('Canal das boas-vindas.').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('imagem')
        .setDescription('Define (ou remove) a imagem/gif fixa do embed.')
        .addStringOption((opt) => opt.setName('url').setDescription('URL da imagem/gif. Deixe vazio para remover.').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('testar').setDescription('Mostra uma prévia das boas-vindas com o seu perfil.'))
    .addSubcommand((sub) => sub.setName('desativar').setDescription('Desativa as boas-vindas.'))
    .addSubcommand((sub) => sub.setName('status').setDescription('Mostra a configuração atual das boas-vindas.')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar as boas-vindas.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'canal') {
      const canal = interaction.options.getChannel('canal', true);
      await guildConfigRepository.setWelcomeChannel(guildId, canal.id);
      await interaction.reply({
        embeds: [successEmbed(`Boas-vindas ativadas em <#${canal.id}>. Use **/boasvindas testar** para ver como ficou.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'imagem') {
      const url = interaction.options.getString('url');
      if (!url) {
        await guildConfigRepository.setWelcomeImage(guildId, null);
        await interaction.reply({ embeds: [successEmbed('Imagem das boas-vindas removida.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const tmp = new EmbedBuilder();
      if (!applyUrl((u) => tmp.setImage(u), url)) {
        await interaction.reply({ embeds: [errorEmbed('URL inválida.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await guildConfigRepository.setWelcomeImage(guildId, url.trim());
      await interaction.reply({ embeds: [successEmbed('Imagem/gif das boas-vindas definida.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'desativar') {
      await guildConfigRepository.setWelcomeChannel(guildId, null);
      await interaction.reply({ embeds: [successEmbed('Boas-vindas desativadas.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'status') {
      const config = await guildConfigRepository.get(guildId);
      const canal = config?.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '*não definido*';
      const imagem = config?.welcomeImageUrl ? `[ver imagem](${config.welcomeImageUrl})` : '*nenhuma*';
      const ativo = config?.welcomeChannelId ? '🟢 ativo' : '🔴 inativo (defina um canal)';
      await interaction.reply({
        embeds: [infoEmbed(`**Boas-vindas**\nStatus: ${ativo}\nCanal: ${canal}\nImagem: ${imagem}`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // testar — prévia com o próprio perfil (efêmera; na entrada real o membro é mencionado no conteúdo).
    const config = await guildConfigRepository.get(guildId);
    const { embed } = buildWelcome(interaction.member, config?.welcomeImageUrl);
    await interaction.reply({
      content: '🔎 Prévia das boas-vindas (na entrada real, o novo membro é marcado no início da mensagem):',
      embeds: [embed],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
