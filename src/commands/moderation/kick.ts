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
import { sendLog } from '../../services/log.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa um membro do servidor.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a expulsar.').setRequired(true))
    .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo da expulsão.').setRequired(false)),

  restricted: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.appPermissions?.has(PermissionFlagsBits.KickMembers)) {
      await interaction.reply({
        embeds: [errorEmbed('Eu não tenho a permissão **Expulsar Membros** neste servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const user = interaction.options.getUser('usuario', true);
    const reason = interaction.options.getString('motivo')?.trim() || 'Sem motivo informado';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        embeds: [errorEmbed('Esse usuário não está no servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const hierarchyError = checkHierarchy(interaction.member, member);
    if (hierarchyError) {
      await interaction.reply({ embeds: [errorEmbed(hierarchyError)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({
        embeds: [errorEmbed('Não consigo expulsar esse membro (o cargo dele está acima do meu).')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const dm = buildPunishmentDM({
      guildName: interaction.guild.name,
      guildIcon: interaction.guild.iconURL({ size: 256 }),
      action: 'expulso',
      color: Palette.warning,
      reason
    });
    await sendGuildDM(member, interaction.guildId, dm);

    await member.kick(`${interaction.user.tag}: ${reason}`);

    await interaction.reply({
      embeds: [successEmbed(`👢 **${user.tag}** foi expulso.\nMotivo: ${reason}`)],
      flags: MessageFlags.Ephemeral
    });

    const logEmbed = new EmbedBuilder()
      .setColor(Palette.warning)
      .setTitle('👢 Membro expulso')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${user} \`${user.tag}\``, inline: true },
        { name: 'Moderador', value: `${interaction.user}`, inline: true },
        { name: 'Motivo', value: reason }
      )
      .setTimestamp();
    await sendLog(interaction.guild, 'punicoes', logEmbed);
  }
};

export default command;
