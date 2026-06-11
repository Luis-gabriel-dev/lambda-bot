import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, Palette, successEmbed } from '../../utils/embeds';
import { buildPunishmentDM, WARN_RESET_GRACE_MS } from '../../services/moderation.service';
import { sendLog } from '../../services/log.service';
import { warnPenaltyRepository } from '../../repositories/warnPenalty.repository';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove o silenciamento (timeout) de um membro.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a desmutar.').setRequired(true))
    .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo.').setRequired(false)),

  restricted: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.appPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({
        embeds: [errorEmbed('Eu não tenho a permissão **Moderar Membros** neste servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const user = interaction.options.getUser('usuario', true);
    const reason = interaction.options.getString('motivo')?.trim() || 'Sem motivo informado';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [errorEmbed('Esse usuário não está no servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!member.isCommunicationDisabled()) {
      await interaction.reply({ embeds: [errorEmbed('Esse membro não está silenciado.')], flags: MessageFlags.Ephemeral });
      return;
    }

    await member.timeout(null, `${interaction.user.tag}: ${reason}`);

    // Se era o mute automático por advertências, inicia o prazo de reset (7 dias) a partir de agora.
    // O job de penalidades envia a DM avisando que o prazo começou.
    const restartedCycle = await warnPenaltyRepository.rescheduleFromNow(
      interaction.guildId,
      user.id,
      new Date(),
      new Date(Date.now() + WARN_RESET_GRACE_MS)
    );

    const dm = buildPunishmentDM({
      guildName: interaction.guild.name,
      guildIcon: interaction.guild.iconURL({ size: 256 }),
      action: 'desmutado',
      color: Palette.success,
      reason
    });
    await member.send({ embeds: [dm] }).catch(() => undefined);

    const extra = restartedCycle
      ? '\nEra o silenciamento automático: o prazo de 7 dias para zerar as advertências começou agora.'
      : '';
    await interaction.reply({
      embeds: [successEmbed(`🔊 **${user.tag}** foi desmutado.${extra}`)],
      flags: MessageFlags.Ephemeral
    });

    const logEmbed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('🔊 Membro desmutado')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${user} \`${user.tag}\``, inline: true },
        { name: 'Moderador', value: `${interaction.user}`, inline: true },
        { name: 'Motivo', value: reason }
      )
      .setTimestamp();
    await sendLog(interaction.guild, 'moderacao', logEmbed); // revogar punição → #log-de-moderação
  }
};

export default command;
