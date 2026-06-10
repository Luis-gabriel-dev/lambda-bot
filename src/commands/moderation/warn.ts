import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  User
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, infoEmbed, Palette, successEmbed } from '../../utils/embeds';
import {
  buildPunishmentDM,
  checkHierarchy,
  WARN_BAN_THRESHOLD,
  WARN_MUTE_MS,
  WARN_MUTE_THRESHOLD
} from '../../services/moderation.service';
import { isOwner } from '../../services/permission.service';
import { sendLog } from '../../services/log.service';
import { warningRepository } from '../../repositories/warning.repository';
import { discordTimestamp, truncate } from '../../utils/formatter';

/**
 * Aplica o escalonamento automático ao atingir os limites de advertências.
 * Retorna um resumo do que aconteceu (para a resposta), ou null se nada foi aplicado.
 */
async function escalate(
  interaction: ChatInputCommandInteraction<'cached'>,
  user: User,
  total: number
): Promise<string | null> {
  const guild = interaction.guild;
  const me = guild.members.me;
  const member = await guild.members.fetch(user.id).catch(() => null);

  if (total >= WARN_BAN_THRESHOLD) {
    if (!me?.permissions.has(PermissionFlagsBits.BanMembers) || (member && !member.bannable)) return null;
    const reason = `Acúmulo de ${total} advertências`;
    const dm = buildPunishmentDM({
      guildName: guild.name,
      guildIcon: guild.iconURL({ size: 256 }),
      action: 'banido',
      color: Palette.error,
      reason
    });
    await user.send({ embeds: [dm] }).catch(() => undefined);
    await guild.bans.create(user.id, { reason }); // guildBanAdd loga no #log-de-bans
    return `atingiu ${total} advertências e foi **banido**`;
  }

  if (total === WARN_MUTE_THRESHOLD) {
    if (!member || !me?.permissions.has(PermissionFlagsBits.ModerateMembers) || !member.moderatable) return null;
    const reason = `Acúmulo de ${total} advertências`;
    const until = new Date(Date.now() + WARN_MUTE_MS);
    const dm = buildPunishmentDM({
      guildName: guild.name,
      guildIcon: guild.iconURL({ size: 256 }),
      action: 'silenciado',
      color: Palette.warning,
      reason,
      until
    });
    await user.send({ embeds: [dm] }).catch(() => undefined);
    await member.timeout(WARN_MUTE_MS, reason);

    const logEmbed = new EmbedBuilder()
      .setColor(Palette.warning)
      .setTitle('🔇 Silenciado automaticamente')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${user} \`${user.tag}\``, inline: true },
        { name: 'Motivo', value: reason, inline: true },
        { name: 'Expira', value: discordTimestamp(until, 'R') }
      )
      .setTimestamp();
    await sendLog(guild, 'punicoes', logEmbed);
    return `atingiu ${total} advertências e foi **silenciado por 1 dia**`;
  }

  return null;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Gerencia advertências de membros.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Adiciona uma advertência a um membro.')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a advertir.').setRequired(true))
        .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo (obrigatório).').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista as advertências de um membro.')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove uma advertência pelo ID.')
        .addIntegerOption((opt) => opt.setName('id').setDescription('ID da advertência (veja em /warn listar).').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('limpar')
        .setDescription('Remove todas as advertências de um membro.')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro.').setRequired(true))
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

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const user = interaction.options.getUser('usuario', true);
      const reasonInput = interaction.options.getString('motivo');
      if (!isOwner(interaction.user.id) && !reasonInput?.trim()) {
        await interaction.editReply({ embeds: [errorEmbed('O **motivo** é obrigatório para advertir.')] });
        return;
      }
      const reason = reasonInput?.trim() || 'Sem motivo informado';

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const hierarchyError = checkHierarchy(interaction.member, member);
        if (hierarchyError) {
          await interaction.editReply({ embeds: [errorEmbed(hierarchyError)] });
          return;
        }
      }

      await warningRepository.add(guildId, user.id, interaction.user.id, reason);
      const total = await warningRepository.count(guildId, user.id);

      const warnDm = buildPunishmentDM({
        guildName: interaction.guild.name,
        guildIcon: interaction.guild.iconURL({ size: 256 }),
        action: 'advertido',
        color: Palette.warning,
        reason,
        note: `Ao acumular **${WARN_MUTE_THRESHOLD}** advertências você será silenciado por 1 dia, e ao atingir **${WARN_BAN_THRESHOLD}** será banido.`
      });
      await user.send({ embeds: [warnDm] }).catch(() => undefined);

      const logEmbed = new EmbedBuilder()
        .setColor(Palette.warning)
        .setTitle('⚠️ Advertência aplicada')
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Usuário', value: `${user} \`${user.tag}\``, inline: true },
          { name: 'Moderador', value: `${interaction.user}`, inline: true },
          { name: 'Total', value: `${total}`, inline: true },
          { name: 'Motivo', value: reason }
        )
        .setTimestamp();
      await sendLog(interaction.guild, 'punicoes', logEmbed);

      const escalation = await escalate(interaction, user, total);
      const summary = escalation
        ? `⚠️ **${user.tag}** foi advertido (total: **${total}**) e ${escalation}.`
        : `⚠️ **${user.tag}** foi advertido (total: **${total}**).`;
      await interaction.editReply({ embeds: [successEmbed(`${summary}\nMotivo: ${reason}`)] });
      return;
    }

    if (sub === 'listar') {
      const user = interaction.options.getUser('usuario', true);
      const warnings = await warningRepository.list(guildId, user.id);

      if (warnings.length === 0) {
        await interaction.reply({
          embeds: [infoEmbed(`**${user.tag}** não tem advertências.`)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const lines = warnings.map(
        (w) =>
          `**#${w.id}** • ${truncate(w.reason, 150)}\n` + `por <@${w.moderatorId}> • ${discordTimestamp(w.createdAt, 'D')}`
      );

      const embed = new EmbedBuilder()
        .setColor(Palette.warning)
        .setTitle(`Advertências de ${user.username} (${warnings.length})`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(truncate(lines.join('\n\n'), 4096));

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'remover') {
      const id = interaction.options.getInteger('id', true);
      const removed = await warningRepository.remove(id, guildId);
      await interaction.reply({
        embeds: [
          removed
            ? successEmbed(`Advertência **#${id}** removida.`)
            : errorEmbed(`Não encontrei a advertência **#${id}** neste servidor.`)
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'limpar') {
      const user = interaction.options.getUser('usuario', true);
      const count = await warningRepository.clear(guildId, user.id);
      await interaction.reply({
        embeds: [
          count > 0
            ? successEmbed(`${count} advertência(s) de **${user.tag}** removida(s).`)
            : infoEmbed(`**${user.tag}** não tinha advertências.`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

export default command;
