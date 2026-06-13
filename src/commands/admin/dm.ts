import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { applyUrl, errorEmbed, infoEmbed, Palette, successEmbed } from '../../utils/embeds';
import { isAdminOrOwner } from '../../services/permission.service';
import { guildConfigRepository } from '../../repositories/guildConfig.repository';
import { buildPunishmentDM } from '../../services/moderation.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Padroniza as mensagens que o bot manda na DM dos membros.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('imagem')
        .setDescription('Define a imagem fixa de todos os embeds de DM (deixe vazio para remover).')
        .addStringOption((opt) => opt.setName('url').setDescription('URL da imagem. Vazio remove.').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('testar').setDescription('Envia uma DM de teste para você ver o padrão.'))
    .addSubcommand((sub) => sub.setName('status').setDescription('Mostra a imagem de DM configurada.')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isAdminOrOwner(interaction.user.id, interaction.memberPermissions)) {
      await interaction.reply({ embeds: [errorEmbed('Apenas administradores podem configurar as DMs.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'imagem') {
      const url = interaction.options.getString('url');
      if (!url) {
        await guildConfigRepository.setDmImage(guildId, null);
        await interaction.reply({ embeds: [successEmbed('Imagem das DMs removida — os embeds voltam ao padrão sem imagem.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const tmp = new EmbedBuilder();
      if (!applyUrl((u) => tmp.setImage(u), url)) {
        await interaction.reply({ embeds: [errorEmbed('URL inválida.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await guildConfigRepository.setDmImage(guildId, url.trim());
      await interaction.reply({ embeds: [successEmbed('Imagem das DMs definida. Use **/dm testar** para conferir.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'status') {
      const config = await guildConfigRepository.get(guildId);
      const imagem = config?.dmImageUrl ? `[ver imagem](${config.dmImageUrl})` : '*nenhuma*';
      await interaction.reply({ embeds: [infoEmbed(`**Imagem padrão das DMs:** ${imagem}`)], flags: MessageFlags.Ephemeral });
      return;
    }

    // testar — manda uma DM de exemplo para quem chamou (aplicando a imagem configurada).
    const sample = buildPunishmentDM({
      guildName: interaction.guild.name,
      guildIcon: interaction.guild.iconURL({ size: 256 }),
      action: 'advertido',
      color: Palette.warning,
      reason: 'Mensagem de exemplo (teste do /dm).'
    });
    const config = await guildConfigRepository.get(guildId);
    if (config?.dmImageUrl) sample.setImage(config.dmImageUrl);

    const sent = await interaction.user
      .send({ embeds: [sample] })
      .then(() => true)
      .catch(() => false);
    await interaction.reply({
      embeds: [
        sent
          ? successEmbed('Te enviei uma DM de teste — confira como ficou o padrão.')
          : errorEmbed('Não consegui te enviar DM (verifique se suas mensagens diretas estão abertas).')
      ],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
