import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, Palette, successEmbed } from '../../utils/embeds';
import { buildPunishmentDM, checkHierarchy, sendGuildDM } from '../../services/moderation.service';
import { isOwner } from '../../services/permission.service';
import { sendLog } from '../../services/log.service';
import { formatDuration, parseDuration } from '../../utils/time';
import { discordTimestamp } from '../../utils/formatter';

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // limite do timeout nativo do Discord

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silencia um membro por um tempo (timeout nativo do Discord).')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a silenciar.').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('tempo').setDescription('Duração: ex. 10m, 2h, 1d (máx. 28d).').setRequired(true)
    )
    .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo (obrigatório).').setRequired(false)),

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

    const reasonInput = interaction.options.getString('motivo');
    if (!isOwner(interaction.user.id) && !reasonInput?.trim()) {
      await interaction.reply({
        embeds: [errorEmbed('O **motivo** é obrigatório para silenciar.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const reason = reasonInput?.trim() || 'Sem motivo informado';
    const user = interaction.options.getUser('usuario', true);
    const ms = parseDuration(interaction.options.getString('tempo', true));

    if (ms === null || ms <= 0) {
      await interaction.reply({
        embeds: [errorEmbed('Tempo inválido. Use formatos como `10m`, `2h` ou `1d`.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    if (ms > MAX_TIMEOUT_MS) {
      await interaction.reply({
        embeds: [errorEmbed('O tempo máximo de silenciamento é **28 dias** (limite do Discord).')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [errorEmbed('Esse usuário não está no servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const hierarchyError = checkHierarchy(interaction.member, member);
    if (hierarchyError) {
      await interaction.reply({ embeds: [errorEmbed(hierarchyError)], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!member.moderatable) {
      await interaction.reply({
        embeds: [errorEmbed('Não consigo silenciar esse membro (o cargo dele está acima do meu).')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await member.timeout(ms, `${interaction.user.tag}: ${reason}`);
    const until = new Date(Date.now() + ms);
    const human = formatDuration(ms);

    const dm = buildPunishmentDM({
      guildName: interaction.guild.name,
      guildIcon: interaction.guild.iconURL({ size: 256 }),
      action: 'silenciado',
      color: Palette.warning,
      reason,
      until
    });
    await sendGuildDM(member, interaction.guildId, dm);

    await interaction.reply({
      embeds: [successEmbed(`🔇 **${user.tag}** foi silenciado por ${human}.\nMotivo: ${reason}`)],
      flags: MessageFlags.Ephemeral
    });

    const logEmbed = new EmbedBuilder()
      .setColor(Palette.warning)
      .setTitle('🔇 Membro silenciado')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${user} \`${user.tag}\``, inline: true },
        { name: 'Moderador', value: `${interaction.user}`, inline: true },
        { name: 'Duração', value: human, inline: true },
        { name: 'Expira', value: discordTimestamp(until, 'R') },
        { name: 'Motivo', value: reason }
      )
      .setTimestamp();
    await sendLog(interaction.guild, 'punicoes', logEmbed);
  }
};

export default command;
