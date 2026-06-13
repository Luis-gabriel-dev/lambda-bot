import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, Palette, successEmbed } from '../../utils/embeds';
import { buildPunishmentDM, checkHierarchy, sendGuildDM } from '../../services/moderation.service';
import { isOwner } from '../../services/permission.service';
import { archiveMessages, collectUserMessages, isAuditEnabled } from '../../services/audit.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bane um usuário do servidor.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário a banir.').setRequired(true))
    .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo do banimento (obrigatório).').setRequired(false))
    .addIntegerOption((opt) =>
      opt
        .setName('apagar_dias')
        .setDescription('Apagar mensagens dos últimos N dias (0 a 7).')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  restricted: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.appPermissions?.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        embeds: [errorEmbed('Eu não tenho a permissão **Banir Membros** neste servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Motivo obrigatório para todos, exceto o dono do bot.
    const reasonInput = interaction.options.getString('motivo');
    if (!isOwner(interaction.user.id) && !reasonInput?.trim()) {
      await interaction.reply({
        embeds: [errorEmbed('O **motivo** é obrigatório para banir.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const reason = reasonInput?.trim() || 'Sem motivo informado';
    const user = interaction.options.getUser('usuario', true);
    const deleteDays = interaction.options.getInteger('apagar_dias') ?? 0;

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const hierarchyError = checkHierarchy(interaction.member, member);
      if (hierarchyError) {
        await interaction.reply({ embeds: [errorEmbed(hierarchyError)], flags: MessageFlags.Ephemeral });
        return;
      }
      if (!member.bannable) {
        await interaction.reply({
          embeds: [errorEmbed('Não consigo banir esse membro (o cargo dele está acima do meu).')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Auditoria: arquiva as mensagens do usuário ANTES de banir (só se houver canal configurado).
    if (await isAuditEnabled(interaction.guildId)) {
      const messages = await collectUserMessages(interaction.guild, user.id);
      await archiveMessages(interaction.guild, `Ban de ${user.tag}`, reason, messages);
    }

    const dm = buildPunishmentDM({
      guildName: interaction.guild.name,
      guildIcon: interaction.guild.iconURL({ size: 256 }),
      action: 'banido',
      color: Palette.error,
      reason
    });
    await sendGuildDM(user, interaction.guildId, dm);

    await interaction.guild.bans.create(user.id, {
      reason: `${interaction.user.tag}: ${reason}`,
      deleteMessageSeconds: deleteDays * 86_400
    });

    await interaction.editReply({
      embeds: [successEmbed(`🔨 **${user.tag}** foi banido.\nMotivo: ${reason}`)]
    });
  }
};

export default command;
